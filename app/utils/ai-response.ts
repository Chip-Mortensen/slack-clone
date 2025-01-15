import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { Pinecone } from "@pinecone-database/pinecone";
import { fetchMessageContext } from "./message-context";
import { supabase } from "../lib/supabase-server";
import { PostgrestSingleResponse } from "@supabase/supabase-js";

// Initialize Pinecone client
const pinecone = new Pinecone();

interface PineconeDoc {
  metadata: {
    table?: string;
    id?: string;
    user_id?: string;
    text?: string;
    [key: string]: any;
  };
  page_content: string;
}

interface PineconeMatch {
  metadata?: {
    table?: string;
    id?: string;
    text?: string;
    user_id?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface MessageReply {
  id: string;
  content: string;
  user_id: string;
  message_id: string;
  created_at: string;
  messages?: {
    id: string;
    content: string;
    user_id: string;
  };
}

interface ThreadReply {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
}

// Shared function to generate embeddings and query Pinecone
export async function generateEmbeddingAndQueryPinecone(content: string, topK = 5) {
  const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);
  const embedding = new OpenAIEmbeddings({ 
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-3-large"
  });
  
  const queryEmbedding = await embedding.embedQuery(content);
  const queryResult = await pineconeIndex.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true
  });

  if (!queryResult.matches || queryResult.matches.length === 0) {
    return null;
  }

  return queryResult.matches.map((match: PineconeMatch) => ({
    metadata: match.metadata || {},
    page_content: String(match.metadata?.text ?? ""),
  }));
}

// Shared function to build context from docs with surrounding messages
export async function buildContextFromDocs(docs: PineconeDoc[], profiles: Record<string, string>) {
  // Fetch context for each matched message in parallel
  const contextPromises = docs.map(async doc => {
    if (!doc.metadata.table || !doc.metadata.id || !doc.metadata.user_id) {
      return null;
    }

    // For replies, we need to fetch the parent message and surrounding replies
    if (doc.metadata.table === 'message_replies') {
      const { data: reply } = await supabase
        .from('message_replies')
        .select(`
          id,
          content,
          user_id,
          message_id,
          messages (
            id,
            content,
            user_id
          )
        `)
        .eq('id', doc.metadata.id)
        .single() as PostgrestSingleResponse<MessageReply>;

      if (!reply) return null;

      // Get surrounding replies for the same parent message
      const { data: surroundingReplies } = await supabase
        .from('message_replies')
        .select('id, content, user_id, created_at')
        .eq('message_id', reply.message_id)
        .order('created_at', { ascending: true }) as PostgrestSingleResponse<ThreadReply[]>;

      if (!surroundingReplies) return null;

      // Format the context group for replies
      const messages = [
        // Parent message first
        `${profiles[reply.messages?.user_id || ''] || "Unknown"}: ${reply.messages?.content || ''}`,
        // Then all replies in chronological order
        ...surroundingReplies.map((r: ThreadReply) => 
          `${profiles[r.user_id] || "Unknown"}: ${r.content}`
        )
      ];

      return messages.join("\n");
    }

    // For regular messages and DMs, use existing context fetching
    const context = await fetchMessageContext(
      doc.metadata.id,
      doc.metadata.table as 'messages' | 'direct_messages'
    );

    if (!context) return null;

    // Format the context group
    const messages = [
      ...context.before.map(msg => `${profiles[msg.user_id] || "Unknown"}: ${msg.content}`),
      `${profiles[doc.metadata.user_id] || "Unknown"}: ${doc.page_content}`,
      ...context.after.map(msg => `${profiles[msg.user_id] || "Unknown"}: ${msg.content}`)
    ];

    return messages.join("\n");
  });

  // Wait for all context fetches to complete
  const contextGroups = await Promise.all(contextPromises);

  // Filter out null results and join with separators
  return contextGroups
    .filter(group => group !== null)
    .join("\n\n=======\n\n");
}

// System prompts for different chat contexts
const CHANNEL_SYSTEM_PROMPT = `You are responding as {username} in a channel conversation. Your primary goal is to match {username}'s communication style:

- Study the context carefully to understand how {username} typically communicates
- Mirror their typical sentence length and complexity
- Use similar language patterns and level of formality
- If they use emojis, use them similarly; if they don't, avoid them
- If they write in short sentences, do the same; if they're more verbose, match that
- Avoid listing or bullet points unless that's how {username} typically communicates

Important: Your response must be plain text only:
- Do not use any markdown formatting (no asterisks, underscores, backticks, hashtags, etc)
- Do not prefix your response with your username or any name
- Do not include colons or ":" in a way that looks like a chat prefix
- Just write the message exactly as {username} would type it

Remember: You're not an AI assistant trying to be helpful - you're {username} having a natural conversation. Your response should feel indistinguishable from how {username} would actually reply based on the context provided.`;

const DM_SYSTEM_PROMPT = `You are {username} in a direct message conversation. Your primary goal is to maintain {username}'s authentic communication style:

- Study the context carefully to understand how {username} typically communicates
- Mirror their typical sentence length and complexity
- Use similar language patterns and level of formality
- If they use emojis, use them similarly; if they don't, avoid them
- If they write in short sentences, do the same; if they're more verbose, match that
- Avoid listing or bullet points unless that's how {username} typically communicates

Important: Your response must be plain text only:
- Do not use any markdown formatting (no asterisks, underscores, backticks, hashtags, etc)
- Do not prefix your response with your username or any name
- Do not include colons or ":" in a way that looks like a chat prefix
- Just write the message exactly as {username} would type it

Remember: You're not an AI assistant trying to be helpful - you're {username} having a natural one-on-one conversation. Your response should feel indistinguishable from how {username} would actually reply based on the context provided.`;

// Create prompts with context
export async function createChannelPrompt(username: string, context: string, message: string) {
  const systemMessage = new SystemMessage({
    content: CHANNEL_SYSTEM_PROMPT.replace(/{username}/g, username)
  });

  const userMessage = new HumanMessage({
    content: `Previous context showing ${username}'s communication style:\n${context}\n\nNew message to respond to:\n${message}`
  });

  return [systemMessage, userMessage];
}

export async function createDirectMessagePrompt(username: string, context: string, message: string) {
  const systemMessage = new SystemMessage({
    content: DM_SYSTEM_PROMPT.replace(/{username}/g, username)
  });

  const userMessage = new HumanMessage({
    content: `Previous context showing ${username}'s communication style:\n${context}\n\nNew message to respond to:\n${message}`
  });

  return [systemMessage, userMessage];
}

// Shared function to generate AI response
export async function generateAIResponse(messages: (SystemMessage | HumanMessage)[], temperature = 0.3) {
  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature,
    modelName: "gpt-4o-mini",
  });
  
  return await llm.invoke(messages);
} 