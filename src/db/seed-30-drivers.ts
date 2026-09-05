import { db, client } from './index';
import { users } from './schema';
import { hashPassword } from '../lib/auth';
import { eq } from 'drizzle-orm';

async function seed30Drivers4Digits() {
  console.log('--- Seeding 30 Drivers (4-Digit Padded) Started ---');
  try {
    const driverList = [];

    for (let i = 1; i <= 30; i++) {
      const numStr = String(i).padStart(4, '0'); // 0001, 0002, etc.
      const driverId = `drv${numStr}`;
      const name = `Driver ${numStr}`;
      const phone = `+91987654${numStr}`;
      const passwordHash = await hashPassword(`Trip@${numStr}`);

      driverList.push({
        usernameOrEmail: driverId,
        name,
        phone,
        passwordHash,
        role: 'DRIVER' as const,
        status: 'ACTIVE' as const,
      });
    }

    for (const d of driverList) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.usernameOrEmail, d.usernameOrEmail))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(users).values(d);
        console.log(`+ Created: ${d.usernameOrEmail} (${d.name})`);
      } else {
        await db
          .update(users)
          .set({ name: d.name })
          .where(eq(users.usernameOrEmail, d.usernameOrEmail));
        console.log(`= Updated: ${d.usernameOrEmail} -> ${d.name}`);
      }
    }

    console.log('--- Seeding 30 Drivers (4-Digit Padded) Completed Successfully ---');
    console.log('Default Password for all drivers: DriverPass123!');
  } catch (error) {
    console.error('Seeding drivers failed:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

seed30Drivers4Digits();
