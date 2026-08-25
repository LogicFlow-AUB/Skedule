import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'node:crypto';

import config from '../config.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';
import { embedQuery, embedTexts } from './embedding.service.js';

let client: QdrantClient | null = null;

const COLLECTION = config.rag.collectionName;
const VECTOR_NAME = 'embeddings';
const VECTOR_SIZE = config.rag.vectorSize;

type Chunk = {
  id: string;
  content: string;
  docId: number;
  chunkIndex: number;
};

// ── Qdrant initialisation ───────────────────────────────────────────

export async function initVectorStore(): Promise<void> {
  client = new QdrantClient({ url: config.qdrant.url });

  try {
    await client.getCollection(COLLECTION);
    logger.info({ collection: COLLECTION }, 'Qdrant collection exists');
  } catch {
    logger.info({ collection: COLLECTION }, 'Creating Qdrant collection');
    await client.createCollection(COLLECTION, {
      vectors: {
        [VECTOR_NAME]: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
      },
      optimizers_config: {
        indexing_threshold: 20000,
      },
    });
    logger.info({ collection: COLLECTION }, 'Qdrant collection created');
  }
}

// ── Text chunking ───────────────────────────────────────────────────

function chunkText(text: string, docId: number, chunkSize = 300, chunkOverlap = 50): Chunk[] {
  const chunks: Chunk[] = [];
  const separators = ['\n\n', '\n'];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    if (end < text.length) {
      let bestSplit = -1;

      for (const sep of separators) {
        const idx = text.lastIndexOf(sep, end);
        if (idx > start && idx > bestSplit) {
          bestSplit = idx + sep.length;
        }
      }

      if (bestSplit > start) {
        end = bestSplit;
      }
    } else {
      end = text.length;
    }

    const content = text.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({
        id: randomUUID(),
        content,
        docId,
        chunkIndex: chunks.length + 1,
      });
    }

    start = end - chunkOverlap;
    if (start >= text.length) break;
  }

  return chunks;
}

// ── Ingestion ───────────────────────────────────────────────────────

export type IngestInput = {
  documents: { text: string; metadata?: Record<string, unknown> }[];
  chunkSize?: number;
  chunkOverlap?: number;
};

export type IngestResult = {
  documentsCount: number;
  chunksCount: number;
};

export async function ingestDocuments(input: IngestInput): Promise<IngestResult> {
  if (!client) {
    throw new AppError(503, 'VECTOR_STORE_UNAVAILABLE', 'Vector store is not initialised.');
  }

  const allChunks: Chunk[] = [];

  if (
    input.chunkSize !== undefined &&
    input.chunkOverlap !== undefined &&
    input.chunkOverlap >= input.chunkSize
  ) {
    throw new AppError(
      400,
      'INVALID_CHUNK_SETTINGS',
      'Chunk overlap must be smaller than the chunk size.',
    );
  }

  for (let i = 0; i < input.documents.length; i++) {
    const doc = input.documents[i]!;
    const chunks = chunkText(doc.text, i + 1, input.chunkSize, input.chunkOverlap);
    allChunks.push(...chunks);
  }

  if (allChunks.length === 0) {
    return { documentsCount: input.documents.length, chunksCount: 0 };
  }

  const embeddings = await embedTexts(allChunks.map((c) => c.content));

  const points = allChunks.map((chunk, i) => ({
    id: chunk.id,
    vector: { [VECTOR_NAME]: embeddings[i]! },
    payload: {
      doc_id: chunk.docId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
    },
  }));

  const batchSize = 100;
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await client.upsert(COLLECTION, { points: batch });
  }

  logger.info(
    { documents: input.documents.length, chunks: allChunks.length },
    'Documents ingested',
  );

  return { documentsCount: input.documents.length, chunksCount: allChunks.length };
}

// ── Retrieval ───────────────────────────────────────────────────────

export type RetrievalResult = {
  docId: number;
  content: string;
  score: number;
};

export async function retrieveChunks(query: string, topK = 10): Promise<RetrievalResult[]> {
  if (!client) {
    throw new AppError(503, 'VECTOR_STORE_UNAVAILABLE', 'Vector store is not initialised.');
  }

  const queryEmbedding = await embedQuery(query);

  const results = await client.query(COLLECTION, {
    query: queryEmbedding,
    using: VECTOR_NAME,
    with_payload: true,
    with_vector: false,
    limit: topK,
  });

  return results.points.flatMap((point) => {
    const payload = point.payload;
    const docId = payload?.doc_id;
    const content = payload?.content;

    if (typeof docId !== 'number' || typeof content !== 'string') {
      logger.warn({ pointId: point.id }, 'Skipping malformed RAG point payload');
      return [];
    }

    return [{ docId, content, score: point.score }];
  });
}

export async function getFullDocument(docId: number): Promise<string> {
  if (!client) {
    throw new AppError(503, 'VECTOR_STORE_UNAVAILABLE', 'Vector store is not initialised.');
  }

  const chunks: string[] = [];
  let offset: string | number | null = null;

  while (true) {
    const result = await client.scroll(COLLECTION, {
      filter: {
        must: [
          {
            key: 'doc_id',
            match: { value: docId },
          },
        ],
      },
      offset: offset ?? null,
      with_payload: true,
      with_vector: false,
      limit: 100,
    });

    for (const point of result.points) {
      chunks.push((point.payload as Record<string, unknown>)?.content as string);
    }

    const nextOffset = result.next_page_offset;
    if (nextOffset === undefined || nextOffset === null) break;
    offset = nextOffset as string | number;
  }

  return chunks.join('\n\n');
}
