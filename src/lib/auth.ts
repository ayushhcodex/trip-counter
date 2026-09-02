import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
const COOKIE_NAME = 'session_token';

export interface SessionPayload {
  userId: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'DRIVER';
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: SessionPayload): string {
  // Sign token to expire in 7 days
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Retrieves the session payload from the HTTP-only cookie in Next.js Server Components / Route Handlers.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch (error) {
    // Fail-safe if cookies() cannot be accessed (e.g. static pages)
    return null;
  }
}

/**
 * Clears the session cookie.
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Sets the session cookie with HTTP-only, secure, sameSite flags.
 */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = signToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}
