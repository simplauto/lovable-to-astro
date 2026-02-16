import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { users } from "../../../lib/db/schema";
import {
  isAllowedDomain,
  hashPassword,
  getUserCount,
} from "../../../lib/auth";

export const POST: APIRoute = async ({ request, redirect }) => {
  // Only allow registration when no users exist (bootstrap)
  if (getUserCount() > 0) {
    return redirect("/login?error=register_closed");
  }

  const form = await request.formData();
  const email = (form.get("email") as string)?.trim().toLowerCase();
  const password = form.get("password") as string;
  const name = (form.get("name") as string)?.trim() || null;

  if (!email || !password) {
    return redirect("/login?error=invalid");
  }

  if (!isAllowedDomain(email)) {
    return redirect("/login?error=domain");
  }

  if (password.length < 8) {
    return redirect("/login?error=short_password");
  }

  const now = new Date().toISOString();
  db.insert(users)
    .values({
      email,
      passwordHash: hashPassword(password),
      name,
      role: "admin",
      createdAt: now,
    })
    .run();

  return redirect("/login?registered=1");
};
