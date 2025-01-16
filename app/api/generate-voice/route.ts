import { NextResponse } from 'next/server';
import { generateAndStoreVoiceMessage } from '@/app/utils/elevenlabs';

export async function POST(request: Request) {
  try {
    const { text, messageId, messageType } = await request.json();

    if (!text || !messageId || !messageType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate messageType
    const validMessageTypes = ['message', 'direct_message', 'message_reply'];
    if (!validMessageTypes.includes(messageType)) {
      return NextResponse.json(
        { error: 'Invalid message type' },
        { status: 400 }
      );
    }

    const voiceUrl = await generateAndStoreVoiceMessage(text, messageId, messageType);

    return NextResponse.json({ voiceUrl });
  } catch (error) {
    console.error('Voice generation route error:', error);
    return NextResponse.json(
      { error: 'Voice generation failed' },
      { status: 500 }
    );
  }
} 