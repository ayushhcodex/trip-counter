import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://ayushsingh@localhost:5432/trip_counter';

// Disable prefetch to prevent issues in serverless or hot-reload environments
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
