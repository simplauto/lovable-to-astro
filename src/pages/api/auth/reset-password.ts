import type { APIRoute } from "astro";
import { hashSync } from "bcryptjs";
import { db } from "../../../lib/db";
import { users, passwordResets } from "../../../lib/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const token = form.get("token") as string;
  const password = form.get("password") as string;

  if (!token || !password || password.length < 8) {
    return new Response(null, { status: 302, headers: { Location: `/reset-password?token=${token}&error=1` } });
  }

  const now = new Date().toISOString();
  const reset = db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.token, token), gt(passwordResets.expiresAt, now), isNull(passwordResets.usedAt)))
    .get();

  if (!reset) {
    return new Response(null, { status: 302, headers: { Location: "/login?error=expired" } });
  }

  const hash = hashSync(password, 12);
  db.update(users).set({ passwordHash: hash }).where(eq(users.id, reset.userId)).run();
  db.update(passwordResets).set({ usedAt: now }).where(eq(passwordResets.id, reset.id)).run();

  return new Response(null, { status: 302, headers: { Location: "/login?reset=done" } });
};
