import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { users } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { isAllowedDomain, verifyPassword, createSession, setSessionCookie } from "../../../lib/auth";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = (form.get("email") as string)?.trim().toLowerCase();
  const password = form.get("password") as string;

  // Same generic error for all failures — no info leak
  if (!email || !password || !isAllowedDomain(email)) {
    return new Response(null, { status: 302, headers: { Location: "/login?error=1" } });
  }

  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return new Response(null, { status: 302, headers: { Location: "/login?error=1" } });
  }

  const token = createSession(user.id);
  const headers = new Headers({ Location: "/" });
  setSessionCookie(headers, token);

  return new Response(null, { status: 302, headers });
};
