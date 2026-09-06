import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://ayushsingh@localhost:5432/trip_counter';

// Disable prefetch to prevent issues in serverless or hot-reload environments
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });

let dieselTableChecked = false;

/**
 * Ensures the diesel_entries table and its indexes exist in the database.
 * Auto-heals in serverless environments without requiring manual migrations.
 */
export async function ensureDieselTable() {
  if (dieselTableChecked) return;
  try {
    await client`
      CREATE TABLE IF NOT EXISTS diesel_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
        admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        date DATE NOT NULL,
        litres NUMERIC(10, 2) NOT NULL,
        notes VARCHAR(500),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await client`CREATE INDEX IF NOT EXISTS idx_diesel_driver_date ON diesel_entries(driver_id, date);`;
    await client`CREATE INDEX IF NOT EXISTS idx_diesel_vehicle_date ON diesel_entries(vehicle_id, date);`;
    dieselTableChecked = true;
  } catch (err) {
    console.error('[ENSURE_DIESEL_TABLE_WARN]', err);
  }
}
