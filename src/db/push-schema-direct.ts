import { client } from './index';
import { hashPassword } from '../lib/auth';

async function setupSupabaseSchema() {
  console.log('--- Initializing Supabase Tables & Enums ---');
  try {
    // 1. Create Enums
    await client`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DRIVER');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;
    await client`
      DO $$ BEGIN
        CREATE TYPE user_status AS ENUM ('ACTIVE', 'LEAVE', 'INACTIVE');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;
    await client`
      DO $$ BEGIN
        CREATE TYPE vehicle_status AS ENUM ('ACTIVE', 'BREAKDOWN', 'INACTIVE');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;
    await client`
      DO $$ BEGIN
        CREATE TYPE verification_status AS ENUM ('UNVERIFIED', 'VERIFIED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;

    // 2. Create Users Table
    await client`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username_or_email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        password_hash VARCHAR(255) NOT NULL,
        role user_role NOT NULL,
        status user_status DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;

    // 3. Create Vehicles Table
    await client`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_number VARCHAR(100) UNIQUE NOT NULL,
        status vehicle_status DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;

    // 4. Create Vehicle Driver Assignments Table
    await client`
      CREATE TABLE IF NOT EXISTS vehicle_driver_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slot INT NOT NULL,
        start_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        end_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;

    // 5. Create Admin Vehicle Assignments Table
    await client`
      CREATE TABLE IF NOT EXISTS admin_vehicle_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT unique_admin_vehicle UNIQUE (admin_id, vehicle_id)
      );
    `;

    // 6. Create Trips Table
    await client`
      CREATE TABLE IF NOT EXISTS trips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
        driver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        completed_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        idempotency_key VARCHAR(255) UNIQUE NOT NULL
      );
    `;
    await client`CREATE INDEX IF NOT EXISTS idx_trips_completed_at ON trips(completed_at);`;
    await client`CREATE INDEX IF NOT EXISTS idx_trips_driver_completed_at ON trips(driver_id, completed_at);`;
    await client`CREATE INDEX IF NOT EXISTS idx_trips_vehicle_completed_at ON trips(vehicle_id, completed_at);`;

    // 7. Create Trip Adjustments Table
    await client`
      CREATE TABLE IF NOT EXISTS trip_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
        date DATE NOT NULL,
        driver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        adjustment INT NOT NULL,
        reason VARCHAR(1000) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await client`CREATE INDEX IF NOT EXISTS idx_adjustments_vehicle_date ON trip_adjustments(vehicle_id, date);`;
    await client`CREATE INDEX IF NOT EXISTS idx_adjustments_driver_date ON trip_adjustments(driver_id, date);`;

    // 8. Create Trip Adjustment Acknowledgements Table
    await client`
      CREATE TABLE IF NOT EXISTS trip_adjustment_acknowledgements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        adjustment_id UUID NOT NULL REFERENCES trip_adjustments(id) ON DELETE CASCADE,
        acknowledged_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        acknowledged_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT unique_adjustment_ack UNIQUE (adjustment_id, acknowledged_by)
      );
    `;

    // 9. Create Daily Vehicle Verifications Table
    await client`
      CREATE TABLE IF NOT EXISTS daily_vehicle_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
        date DATE NOT NULL,
        reported_trip_count INT DEFAULT 0 NOT NULL,
        adjustment_total INT DEFAULT 0 NOT NULL,
        verified_trip_count INT DEFAULT 0 NOT NULL,
        status verification_status DEFAULT 'UNVERIFIED' NOT NULL,
        verified_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        verified_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        note VARCHAR(1000),
        CONSTRAINT unique_vehicle_date UNIQUE (vehicle_id, date)
      );
    `;
    await client`CREATE INDEX IF NOT EXISTS idx_verifications_vehicle_date ON daily_vehicle_verifications(vehicle_id, date);`;

    // 10. Create Notifications Table
    await client`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message VARCHAR(1000) NOT NULL,
        related_entity_id UUID,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;

    // 11. Create Audit Logs Table
    await client`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;

    // 12. Create Diesel Entries Table
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

    console.log('✅ All Database Tables and Indexes Created Successfully!');

    // Seed Super Admin
    const adminEmail = 'superadmin@tripcounter.org';
    const adminPass = await hashPassword('SuperAdminPass123!');
    await client`
      INSERT INTO users (username_or_email, name, phone, password_hash, role, status)
      VALUES (${adminEmail}, 'System Super Admin', '+15550100', ${adminPass}, 'SUPER_ADMIN', 'ACTIVE')
      ON CONFLICT (username_or_email) DO NOTHING;
    `;
    console.log('✅ Super Admin Seeded: superadmin@tripcounter.org / SuperAdminPass123!');

    // Seed 30 Drivers
    for (let i = 1; i <= 30; i++) {
      const numStr = String(i).padStart(4, '0');
      const driverId = `drv${numStr}`;
      const name = `Driver ${numStr}`;
      const phone = `+91987654${numStr}`;
      const pass = await hashPassword(`Trip@${numStr}`);
      await client`
        INSERT INTO users (username_or_email, name, phone, password_hash, role, status)
        VALUES (${driverId}, ${name}, ${phone}, ${pass}, 'DRIVER', 'ACTIVE')
        ON CONFLICT (username_or_email) DO UPDATE SET password_hash = ${pass}, name = ${name};
      `;
    }
    console.log('✅ 30 Sequential Drivers Seeded: drv0001 - drv0030 / Trip@0001 - Trip@0030');

    // Also seed drv001 for convenience
    const pass001 = await hashPassword('Trip@001');
    await client`
      INSERT INTO users (username_or_email, name, phone, password_hash, role, status)
      VALUES ('drv001', 'Driver 001', '+919876540001', ${pass001}, 'DRIVER', 'ACTIVE')
      ON CONFLICT (username_or_email) DO UPDATE SET password_hash = ${pass001};
    `;
    console.log('✅ Driver drv001 Seeded / Trip@001');

  } catch (error) {
    console.error('❌ Supabase schema setup error:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

setupSupabaseSchema();
