import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export async function getSession() {
  return await auth();
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

export async function requireAuth() {
  const session = await auth();
  if (!session) {
    redirect('/auth/login');
  }
  return session;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session) {
    redirect('/auth/admin-login');
  }
  if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
    redirect('/');
  }
  return session;
}

export async function requireSuperAdmin() {
  const session = await auth();
  if (!session) {
    redirect('/auth/admin-login');
  }
  if (session.user.role !== 'superadmin') {
    redirect('/admin');
  }
  return session;
}

export function isAdmin(role: string) {
  return role === 'admin' || role === 'superadmin';
}

export function isSuperAdmin(role: string) {
  return role === 'superadmin';
}
