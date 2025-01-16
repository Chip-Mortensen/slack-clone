import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function generateAndStoreVoiceMessage(
  text: string,
  messageId: string,
  messageType: 'message' | 'direct_message' | 'message_reply'
) {
  try {
    // ElevenLabs API call
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    // Get the audio buffer
    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    // Generate a unique filename
    const filename = `${messageId}-${Date.now()}.mp3`;
    const filePath = `${messageType}/${filename}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('message-voice-recordings')
      .upload(filePath, audioBlob, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(`Storage upload error: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('message-voice-recordings')
      .getPublicUrl(filePath);

    // Update the corresponding table with the voice URL
    const tableMap = {
      message: 'messages',
      direct_message: 'direct_messages',
      message_reply: 'message_replies',
    };

    const { error: updateError } = await supabase
      .from(tableMap[messageType])
      .update({ voice_url: publicUrl })
      .eq('id', messageId);

    if (updateError) {
      throw new Error(`Database update error: ${updateError.message}`);
    }

    return publicUrl;
  } catch (error) {
    console.error('Voice generation error:', error);
    throw error;
  }
} 