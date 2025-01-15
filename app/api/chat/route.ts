import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase-server";
import { fetchProfiles } from "../../utils/profiles";
import { 
  generateEmbeddingAndQueryPinecone, 
  buildContextFromDocs, 
  generateAIResponse,
  createDirectMessagePrompt 
} from "../../utils/ai-response";

interface ChatRequest {
  query?: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
}

export async function POST(request: Request) {
  try {
    const { 
      query = "What are the key features of the product we discussed?",
      conversationId,
      senderId,
      receiverId
    }: ChatRequest = await request.json();

    // Fetch profiles
    const profiles = await fetchProfiles();
    const receiverUsername = profiles[receiverId] || "Unknown";

    // Query Pinecone for relevant context
    console.log("Querying Pinecone vector store...");
    const docs = await generateEmbeddingAndQueryPinecone(query);
    
    if (!docs) {
      return NextResponse.json({ status: "no_documents", response: "No relevant documents found." });
    }

    // Build context from docs
    const context = await buildContextFromDocs(docs, profiles);

    // Generate prompt and get AI response
    console.log("Generating AI response...");
    const promptWithContext = await createDirectMessagePrompt(receiverUsername, context, query);
    const response = await generateAIResponse(promptWithContext);

    // Insert the response into the direct_messages table
    const { error: insertError } = await supabase
      .from('direct_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: receiverId,
        receiver_id: senderId,
        message: response.text
      });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ status: "success", response: response.text });
  } catch (error: any) {
    console.error("Error in chat:", error);
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }
}