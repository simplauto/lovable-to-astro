import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { compareSync } from "bcryptjs";
import { db } from "./db";
import { users, sessions } from "./db/schema";
import { eq, and, gt } from "drizzle-orm";

const SESSION_COOKIE = "session";
const SESSION_TTL_DAYS = 7;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET ?? import.meta.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

// --- Password ---

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

// --- Sessions ---

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400000).toISOString();

  db.insert(sessions).values({ token, userId, expiresAt, createdAt: now }).run();

  return token;
}

export function validateSession(token: string): { id: number; email: string; name: string | null; role: string } | null {
  const now = new Date().toISOString();
  const result = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
    .get();

  return result ?? null;
}

export function deleteSession(token: string): void {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}

// --- Cookies ---

function sign(value: string): string {
  const mac = createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return value;
}

export function getSessionFromCookie(request: Request): string | null {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const signed = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  return unsign(signed);
}

export function setSessionCookie(headers: Headers, token: string): void {
  const signed = sign(token);
  const maxAge = SESSION_TTL_DAYS * 86400;
  headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );
}

export function clearSessionCookie(headers: Headers): void {
  headers.set("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

