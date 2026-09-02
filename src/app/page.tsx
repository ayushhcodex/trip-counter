import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function IndexPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role === 'SUPER_ADMIN') {
    redirect('/superadmin');
  } else if (session.role === 'ADMIN') {
    redirect('/admin');
  } else if (session.role === 'DRIVER') {
    redirect('/driver');
  }

  redirect('/login');
}
