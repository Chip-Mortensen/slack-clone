import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase-service";
import { fetchProfiles } from "../../utils/profiles";
import { 
  generateEmbeddingAndQueryPinecone, 
  buildContextFromDocs, 
  generateAIResponse,
  createChannelPrompt 
} from "../../utils/ai-response";

interface ChannelChatRequest {
  messageId: string;
  channelId: string;
  content: string;
  senderId: string;
  responderId: string;
}

export async function POST(request: Request) {
  try {
    const { messageId, channelId, content, senderId, responderId }: ChannelChatRequest = await request.json();

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

    // Insert the AI response
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        content: response.text,
        user_id: responderId,
        channel_id: channelId
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting AI response:', insertError)
      return NextResponse.json({ error: 'Failed to save AI response' }, { status: 500 })
    }

    // Trigger voice generation for AI response
    /* Commented out to prevent API usage
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
    fetch(`${origin}/api/generate-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: response.text,
        messageId: message.id,
        messageType: 'message'
      })
    }).catch(error => {
      console.error('Voice generation error for AI response:', error)
      // Don't throw - we want voice generation to be non-blocking
    })
    */

    return NextResponse.json({ status: 'success', message: 'AI response sent' })
  } catch (error: any) {
    console.error("Error in channel-chat:", error);
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }
} 