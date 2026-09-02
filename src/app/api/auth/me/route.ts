import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';

export async function GET() {
  // Use authorization guard middleware
  const { user, errorResponse } = await checkAuth();
  if (errorResponse) return errorResponse;

  try {
    // Retrieve full profile from database to ensure fresh data (e.g. status changes)
    const [dbUser] = await db
      .select({
        id: users.id,
        usernameOrEmail: users.usernameOrEmail,
        name: users.name,
        phone: users.phone,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, user!.userId))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User does not exist or has been deleted.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: dbUser,
    });
  } catch (error) {
    console.error('[ME_API_ERROR]', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
