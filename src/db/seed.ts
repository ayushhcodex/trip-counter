import { db, client } from './index';
import { users } from './schema';
import { hashPassword } from '../lib/auth';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('--- Database Seeding Started ---');
  try {
    const adminUsernameOrEmail = 'superadmin@tripcounter.org';
    
    // Check if default superadmin exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.usernameOrEmail, adminUsernameOrEmail))
      .limit(1);

    if (existing.length > 0) {
      console.log('Superadmin user already exists. Skipping creation.');
    } else {
      const passwordHash = await hashPassword('SuperAdminPass123!');
      
      await db.insert(users).values({
        usernameOrEmail: adminUsernameOrEmail,
        name: 'System Super Admin',
        phone: '+15550100',
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      });
      
      console.log('Created default Super Admin:');
      console.log(`- Username/Email: ${adminUsernameOrEmail}`);
      console.log('- Password: SuperAdminPass123!');
    }

    console.log('--- Database Seeding Completed Successfully ---');
  } catch (error) {
    console.error('Seeding database failed:', error);
  } finally {
    // Close the postgres connection pool cleanly
    await client.end();
    process.exit(0);
  }
}

seed();
