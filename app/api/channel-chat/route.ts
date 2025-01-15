import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase-server";
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
    const { 
      messageId,
      channelId,
      content,
      senderId,
      responderId
    }: ChannelChatRequest = await request.json();

    console.log('Received request:', { messageId, channelId, content, senderId, responderId })

    // Fetch profiles for context
    const profiles = await fetchProfiles();
    const responderUsername = profiles[responderId] || "Unknown";
    console.log('Responder username:', responderUsername)

    // Query Pinecone for relevant context
    const docs = await generateEmbeddingAndQueryPinecone(content);
    console.log('Found context matches:', docs?.length || 0)

    // Build context from docs
    const context = docs ? await buildContextFromDocs(docs, profiles) : "";
    console.log('Generated prompt with context')

    // Generate prompt and get AI response
    const promptWithContext = await createChannelPrompt(responderUsername, context, content);
    console.log('Generated prompt with context')

    const response = await generateAIResponse(promptWithContext);
    console.log('Generated AI response:', response.text)

    // Insert the AI response
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        content: response.text,
        user_id: responderId,
        channel_id: channelId
      });

    if (insertError) {
      console.error('Error inserting response:', insertError)
      throw insertError
    }

    console.log('Successfully inserted AI response')
    return NextResponse.json({ status: "success", response: "Message sent" });
  } catch (error: any) {
    console.error("Error in channel-chat:", error);
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }
} 