import { NextResponse } from 'next/server';
import { getSession, SessionPayload } from './auth';

/**
 * Checks for a valid session and verifies if the user has the required roles.
 * Returns either the authorized user details or a NextResponse containing the HTTP error.
 */
export async function checkAuth(
  allowedRoles?: ('SUPER_ADMIN' | 'ADMIN' | 'DRIVER')[]
): Promise<{
  user: SessionPayload | null;
  errorResponse?: NextResponse;
}> {
  const user = await getSession();

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized. Session expired or missing.' },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      user,
      errorResponse: NextResponse.json(
        { error: 'Forbidden. Insufficient permissions.' },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: undefined };
}
