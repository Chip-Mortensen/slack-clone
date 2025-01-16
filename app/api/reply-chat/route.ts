import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase-server";
import { fetchProfiles } from "../../utils/profiles";
import { 
  generateEmbeddingAndQueryPinecone, 
  buildContextFromDocs, 
  generateAIResponse,
  createChannelPrompt 
} from "../../utils/ai-response";

interface ReplyChatRequest {
  messageId: string;
  replyId: string;
  content: string;
  senderId: string;
  responderId: string;
}

export async function POST(request: Request) {
  try {
    const { messageId, replyId, content, senderId, responderId }: ReplyChatRequest = await request.json();

    // Fetch profiles for context
    const profiles = await fetchProfiles();
    const responderUsername = profiles[responderId] || "Unknown";

    // Query Pinecone for relevant context
    const docs = await generateEmbeddingAndQueryPinecone(content);

    // Build context from docs
    const context = docs ? await buildContextFromDocs(docs, profiles) : "";

    // Generate prompt and get AI response
    const promptWithContext = await createChannelPrompt(responderUsername, context, content);

    const response = await generateAIResponse(promptWithContext);

    // Insert the AI response as a reply
    const { error: insertError } = await supabase
      .from('message_replies')
      .insert({
        message_id: messageId,
        user_id: responderId,
        content: response.text
      });

    if (insertError) {
      console.error('Error inserting response:', insertError);
      throw insertError;
    }

    return NextResponse.json({ status: "success", response: "Reply sent" });
  } catch (error: any) {
    console.error("Error in reply-chat:", error);
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }
} 