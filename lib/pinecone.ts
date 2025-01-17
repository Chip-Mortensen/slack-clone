import { Pinecone } from "@pinecone-database/pinecone";

/**
 * Centralized Pinecone client for vector database operations.
 * This client should be used for all Pinecone operations to maintain consistency
 * and avoid multiple client instantiations.
 */
export const pinecone = new Pinecone(); 