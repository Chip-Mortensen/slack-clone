#!/usr/bin/env node
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from "@supabase/supabase-js";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";

// Validate required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'PINECONE_INDEX'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const pinecone = new Pinecone();

// Fetch unvectorized data from Supabase
async function fetchUnvectorizedData() {
  console.log("Fetching unvectorized data...");
  
  const [messages, directMessages, replies] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("is_vectorized", false),
    supabase
      .from("direct_messages")
      .select("*")
      .eq("is_vectorized", false),
    supabase
      .from("message_replies")
      .select("*")
      .eq("is_vectorized", false),
  ]);

  console.log(`Fetched ${messages.data?.length || 0} messages`);
  console.log(`Fetched ${directMessages.data?.length || 0} direct messages`);
  console.log(`Fetched ${replies.data?.length || 0} replies`);

  return {
    messages: messages.data || [],
    directMessages: directMessages.data || [],
    replies: replies.data || [],
  };
}

// Convert rows to Documents
function rowsToDocuments(data: {
  messages: any[];
  directMessages: any[];
  replies: any[];
}) {
  const docs: Document[] = [];

  data.messages.forEach((m) => {
    if (!m.content) return;
    docs.push(
      new Document({
        pageContent: m.content,
        metadata: {
          table: "messages",
          id: m.id,
          user_id: m.user_id,
        },
      })
    );
  });

  data.directMessages.forEach((dm) => {
    if (!dm.message) return;
    docs.push(
      new Document({
        pageContent: dm.message,
        metadata: {
          table: "direct_messages",
          id: dm.id,
          user_id: dm.sender_id,
        },
      })
    );
  });

  data.replies.forEach((r) => {
    if (!r.content) return;
    docs.push(
      new Document({
        pageContent: r.content,
        metadata: {
          table: "message_replies",
          id: r.id,
          user_id: r.user_id,
        },
      })
    );
  });

  return docs;
}

// Split documents into chunks
async function splitDocuments(docs: Document[]) {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });
  return await textSplitter.splitDocuments(docs);
}

// Upload documents to Pinecone
async function uploadToPinecone(docs: Document[]) {
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-3-large",
  });

  const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);

  for (const doc of docs) {
    const embedding = await embeddings.embedQuery(doc.pageContent);
    
    // Ensure metadata only contains valid types
    const sanitizedMetadata = {
      table: String(doc.metadata.table),
      id: String(doc.metadata.id),
      user_id: String(doc.metadata.user_id),
      text: doc.pageContent
    };

    await pineconeIndex.upsert([
      {
        id: `${doc.metadata.table}-${doc.metadata.id}`,
        values: embedding,
        metadata: sanitizedMetadata,
      },
    ]);

    // Log progress
    console.log(`Uploaded document ${doc.metadata.table}-${doc.metadata.id}`);
  }
}

// Mark rows as vectorized in Supabase
async function markAsVectorized(metadataList: any[]) {
  for (const metadata of metadataList) {
    await supabase
      .from(metadata.table)
      .update({ is_vectorized: true })
      .eq("id", metadata.id);
    console.log(`Updated row ${metadata.id} in table ${metadata.table}`);
  }
}

async function main() {
  try {
    // Fetch unvectorized data
    const data = await fetchUnvectorizedData();

    // Convert to Documents
    const docs = rowsToDocuments(data);

    if (docs.length === 0) {
      console.log("No unvectorized rows found.");
      return;
    }

    // Split if large
    const splittedDocs = await splitDocuments(docs);
    console.log(`Ready to embed ${splittedDocs.length} total chunks.`);

    // Upload to Pinecone
    await uploadToPinecone(splittedDocs);

    // Mark them as vectorized
    const originalMeta = Array.from(
      new Set(splittedDocs.map((d) => JSON.stringify(d.metadata)))
    ).map((m) => JSON.parse(m));
    
    await markAsVectorized(originalMeta);

    console.log(`Successfully vectorized ${splittedDocs.length} documents`);
  } catch (error: any) {
    console.error("Vectorization error:", error);
    process.exit(1);
  }
}

main(); 