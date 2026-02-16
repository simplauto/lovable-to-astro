import type { APIRoute } from "astro";
import { randomBytes } from "node:crypto";
import { db } from "../../../lib/db";
import { users, passwordResets } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { isAllowedDomain } from "../../../lib/auth";
import { sendPasswordResetEmail } from "../../../lib/email";

export const POST: APIRoute = async ({ request, url }) => {
  const form = await request.formData();
  const email = (form.get("email") as string)?.trim().toLowerCase();

  // Always show the same message — no info leak
  const successRedirect = "/login?reset=1";

  if (!email || !isAllowedDomain(email)) {
    return new Response(null, { status: 302, headers: { Location: successRedirect } });
  }

  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    return new Response(null, { status: 302, headers: { Location: successRedirect } });
  }

  const token = randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

  db.insert(passwordResets)
    .values({ userId: user.id, token, expiresAt, createdAt: now })
    .run();

  const baseUrl = `${url.protocol}//${url.host}`;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await sendPasswordResetEmail(email, resetUrl);

  return new Response(null, { status: 302, headers: { Location: successRedirect } });
};
