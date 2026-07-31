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
} as const;

export default config;
