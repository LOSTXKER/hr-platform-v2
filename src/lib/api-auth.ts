// Auth helper for API routes — verifies Supabase session + returns user + org context
// Pattern: every API route calls requireAuth() first; throws → 401

import { createClient } from "./supabase/server";
import { prisma } from "./prisma";

export class AuthError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export type AuthContext = {
  userId: string;
  email: string;
  organizationId: string;
  role: string; // OWNER | ADMIN | HR | MANAGER | MEMBER
};

export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new AuthError(401, "not authenticated");
  }
  const user = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: { id: true, email: true, organizationId: true, role: true },
  });
  if (!user) {
    throw new AuthError(403, "user has no org membership");
  }
  return {
    userId: user.id,
    email: user.email,
    organizationId: user.organizationId,
    role: user.role,
  };
}

export function requireRole(ctx: AuthContext, allowed: ReadonlyArray<string>): void {
  if (!allowed.includes(ctx.role)) {
    throw new AuthError(403, `role ${ctx.role} not allowed (need one of ${allowed.join("/")})`);
  }
}
