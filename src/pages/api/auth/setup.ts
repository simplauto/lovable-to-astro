import type { APIRoute } from "astro";
import { hashSync } from "bcryptjs";
import { db } from "../../../lib/db";
import { users } from "../../../lib/db/schema";
import { isAllowedDomain } from "../../../lib/auth";
import { eq } from "drizzle-orm";

/**
 * Bootstrap endpoint to create a user.
 * Protected by SESSION_SECRET as bearer token.
 * Usage: curl -X POST -H "Authorization: Bearer <SESSION_SECRET>" \
 *   -d '{"email":"...","password":"...","name":"..."}' \
 *   https://.../api/auth/setup
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = process.env.SESSION_SECRET ?? import.meta.env.SESSION_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const { email, password, name } = body;

  if (!email || !password || password.length < 8) {
    return new Response(JSON.stringify({ error: "invalid input" }), { status: 400 });
  }

  if (!isAllowedDomain(email)) {
    return new Response(JSON.stringify({ error: "domain not allowed" }), { status: 403 });
  }

  const existing = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  if (existing) {
    return new Response(JSON.stringify({ error: "email already exists" }), { status: 409 });
  }

  const now = new Date().toISOString();
  db.insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash: hashSync(password, 12),
      name: name || null,
      role: "admin",
      createdAt: now,
    })
    .run();

  return new Response(JSON.stringify({ ok: true, email }), { status: 201 });
};
