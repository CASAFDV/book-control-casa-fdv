import { createClient } from '@libsql/client';

const globalForTurso = globalThis as unknown as {
  turso: ReturnType<typeof createClient> | undefined;
};

export const turso =
  globalForTurso.turso ??
  createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

if (process.env.NODE_ENV !== 'production') globalForTurso.turso = turso;

export default turso;
