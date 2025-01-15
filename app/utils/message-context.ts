import { supabase } from "../lib/supabase-server";
import { PostgrestSingleResponse } from "@supabase/supabase-js";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

interface ChannelMessage {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel_id: string;
}

interface DirectMessage {
  id: string;
  message: string;
  created_at: string;
  sender_id: string;
  conversation_id: string;
}

interface MessageContext {
  before: Message[];
  matched: Message | null;
  after: Message[];
}

type DatabaseMessage = ChannelMessage | DirectMessage;

interface QueryMessage {
  id: string;
  created_at: string;
  user_id?: string;
  content?: string;
  message?: string;
  channel_id?: string;
  conversation_id?: string;
  sender_id?: string;
}

/**
 * Fetches surrounding context for a message efficiently using regular queries
 */
export async function fetchMessageContext(messageId: string, table: 'messages' | 'direct_messages'): Promise<MessageContext | null> {
  try {
    // First get the target message to get its timestamp and channel/conversation ID
    const { data: targetMessage, error: targetError } = await supabase
      .from(table)
      .select('*')
      .eq('id', messageId)
      .single() as PostgrestSingleResponse<QueryMessage>;

    if (targetError || !targetMessage) {
      console.error('Error fetching target message:', targetError);
      return null;
    }

    const target = targetMessage;
    const idField = table === 'messages' ? 'channel_id' : 'conversation_id';
    const contentField = table === 'messages' ? 'content' : 'message';
    const userField = table === 'messages' ? 'user_id' : 'sender_id';
    const idValue = table === 'messages' ? target.channel_id : target.conversation_id;

    // Get messages before the target message
    const { data: beforeMessages, error: beforeError } = await supabase
      .from(table)
      .select(`id, created_at, ${userField}, ${contentField}`)
      .eq(idField, idValue)
      .lt('created_at', target.created_at)
      .order('created_at', { ascending: false })
      .limit(2) as PostgrestSingleResponse<QueryMessage[]>;

    if (beforeError) {
      console.error('Error fetching before messages:', beforeError);
      return null;
    }

    // Get messages after the target message
    const { data: afterMessages, error: afterError } = await supabase
      .from(table)
      .select(`id, created_at, ${userField}, ${contentField}`)
      .eq(idField, idValue)
      .gt('created_at', target.created_at)
      .order('created_at', { ascending: true })
      .limit(2) as PostgrestSingleResponse<QueryMessage[]>;

    if (afterError) {
      console.error('Error fetching after messages:', afterError);
      return null;
    }

    // Format the target message to match the Message interface
    const formattedTarget: Message = {
      id: target.id,
      content: table === 'messages' ? target.content! : target.message!,
      created_at: target.created_at,
      user_id: table === 'messages' ? target.user_id! : target.sender_id!
    };

    // Format before/after messages to match the Message interface
    const formattedBefore = (beforeMessages || []).map((msg: QueryMessage) => ({
      id: msg.id,
      content: table === 'messages' ? msg.content! : msg.message!,
      created_at: msg.created_at,
      user_id: table === 'messages' ? msg.user_id! : msg.sender_id!
    })).reverse(); // Reverse to get chronological order

    const formattedAfter = (afterMessages || []).map((msg: QueryMessage) => ({
      id: msg.id,
      content: table === 'messages' ? msg.content! : msg.message!,
      created_at: msg.created_at,
      user_id: table === 'messages' ? msg.user_id! : msg.sender_id!
    }));

    return {
      before: formattedBefore,
      matched: formattedTarget,
      after: formattedAfter
    };
  } catch (error) {
    console.error('Error in fetchMessageContext:', error);
    return null;
  }
} 