import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { users } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";
import {
  isAllowedDomain,
  verifyPassword,
  createSession,
  setSessionCookie,
} from "../../../lib/auth";

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const email = (form.get("email") as string)?.trim().toLowerCase();
  const password = form.get("password") as string;

  if (!email || !password) {
    return redirect("/login?error=invalid");
  }

  if (!isAllowedDomain(email)) {
    return redirect("/login?error=domain");
  }

  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return redirect("/login?error=invalid");
  }

  const token = createSession(user.id);
  const headers = new Headers({ Location: "/" });
  setSessionCookie(headers, token);

  return new Response(null, { status: 302, headers });
};
