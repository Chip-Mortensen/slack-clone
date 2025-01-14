import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Pinecone client
const pinecone = new Pinecone();

// Fetch all profiles from the Supabase `profiles` table
async function fetchProfiles() {
  try {
    console.log("Fetching profiles from Supabase...");
    const { data, error } = await supabase.from("profiles").select("id, username");

    if (error) {
      console.error("Error fetching profiles:", error);
      return {};
    }

    if (data) {
      const profiles: Record<string, string> = {};
      data.forEach((profile) => {
        profiles[profile.id] = profile.username;
      });
      console.log(`Fetched ${data.length} profiles.`);
      return profiles;
    }

    return {};
  } catch (error) {
    console.error("Error fetching profiles:", error);
    return {};
  }
}

// Replace `user_id` in document metadata with `username`
function replaceUserIdsWithUsernames(
  docs: Array<{ metadata: Record<string, any>; page_content: string }>,
  profiles: Record<string, string>
) {
  docs.forEach((doc) => {
    const userId = doc.metadata?.user_id;
    if (userId && profiles[userId]) {
      doc.metadata.username = profiles[userId];
      delete doc.metadata.user_id;
    }
  });
  return docs;
}

// Next.js Route Handler (App Router)
export async function POST(request: Request) {
  try {
    const { 
      query = "What are the key features of the product we discussed?",
      conversationId,
      senderId,
      receiverId
    } = await request.json();

    // Fetch profiles
    const profiles = await fetchProfiles();

    // Get receiver's username for personalization
    const receiverUsername = profiles[receiverId] || "Unknown";

    // Query Pinecone for relevant documents
    console.log("Querying Pinecone vector store...");
    const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);
    const embedding = new OpenAIEmbeddings({ 
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-large"
    });
    const queryEmbedding = await embedding.embedQuery(query);

    const queryResult = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    });
    console.log(queryResult);

    if (!queryResult.matches || queryResult.matches.length === 0) {
      return NextResponse.json({ status: "no_documents", response: "No relevant documents found." });
    }

    const retrievedDocs = queryResult.matches.map((match) => ({
      metadata: match.metadata || {},
      page_content: String(match.metadata?.text ?? ""),
    }));

    // Replace `user_id` with `username`
    console.log("Replacing user_id with username...");
    const updatedDocs = replaceUserIdsWithUsernames(retrievedDocs, profiles);

    // Build context for the prompt
    const context = updatedDocs
      .map(
        (doc) =>
          `Username: ${doc.metadata.username || "Unknown"}\nContent: ${doc.page_content}`
      )
      .join("\n\n");

    // Adjust the prompt
    const template = new PromptTemplate({
      template:
        `You are ${receiverUsername}, having a conversation in a team chat. 
        Respond to the message naturally and conversationally, as if you were ${receiverUsername}.
        Base your response on the context from previous messages, but maintain a casual, friendly tone.
        If you're not sure about something, it's okay to say so - just respond as ${receiverUsername} would in a chat.
        
        Previous messages for context:
        {context}
        
        Message you're responding to:
        {query}
        
        Your response as ${receiverUsername}:`,
      inputVariables: ["query", "context"],
    });
    const promptWithContext = await template.format({ query, context });

    // Ask OpenAI for a response
    console.log("Querying OpenAI for a response...");
    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.7,
      modelName: "gpt-4o-mini",
    });
    const response = await llm.invoke(promptWithContext);

    // Insert the AI response using service role client
    if (conversationId && senderId && receiverId) {
      await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: receiverId,
          receiver_id: senderId,
          message: response.text
        });
    }

    return NextResponse.json({ status: "success", response: "Message sent" });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }
}