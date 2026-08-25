import 'dotenv/config';

function readOptionalValue(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue || undefined;
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port number.');
  }

  return port;
}

const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: readPort(process.env.PORT),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:8443',
  supabase: {
    url: readOptionalValue(process.env.SUPABASE_URL),
    anonKey: readOptionalValue(process.env.SUPABASE_ANON_KEY),
    serviceRoleKey: readOptionalValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
  },
  aub: {
    baseUrl:
      process.env.AUB_REGISTRATION_URL ?? 'https://sturegss.aub.edu.lb/StudentRegistrationSsb',
    termCode: process.env.AUB_SYNC_TERM_CODE ?? '202710',
    syncIntervalMs: Number(process.env.AUB_SYNC_INTERVAL_MS ?? 600_000),
    syncOnStartup: (process.env.AUB_SYNC_ON_STARTUP ?? 'true') === 'true',
  },
  qdrant: {
    url: readOptionalValue(process.env.QDRANT_URL) ?? 'http://localhost:6333',
  },
  rag: {
    embeddingModel: readOptionalValue(process.env.RAG_EMBEDDING_MODEL) ?? 'Xenova/all-MiniLM-L6-v2',
    collectionName: readOptionalValue(process.env.RAG_COLLECTION_NAME) ?? 'knowledge_base',
    vectorSize: Number(process.env.RAG_VECTOR_SIZE ?? 384),
  },
  hf: {
    apiToken: readOptionalValue(process.env.HF_API_TOKEN),
    model: readOptionalValue(process.env.HF_MODEL) ?? 'openai-community/gpt2',
  },
  gemini: {
    apiKey: readOptionalValue(process.env.GEMINI_API_KEY),
  },
} as const;

export default config;
