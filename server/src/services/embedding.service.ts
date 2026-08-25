import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

import config from '../config.js';
import { logger } from '../utils/logger.js';

let extractor: FeatureExtractionPipeline | null = null;

export async function initEmbedding(): Promise<void> {
  if (extractor) return;

  logger.info({ model: config.rag.embeddingModel }, 'Loading embedding model');
  extractor = await pipeline('feature-extraction', config.rag.embeddingModel);
  logger.info('Embedding model loaded');
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!extractor) {
    throw new Error('Embedding model not initialised. Call initEmbedding() first.');
  }

  const embeddings: number[][] = [];

  for (const text of texts) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    embeddings.push(Array.from(output.data) as number[]);
  }

  return embeddings;
}

export async function embedQuery(query: string): Promise<number[]> {
  const embeddings = await embedTexts([query]);
  const embedding = embeddings[0];

  if (!embedding) {
    throw new Error('Failed to generate embedding for query.');
  }

  return embedding;
}
