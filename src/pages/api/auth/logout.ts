import type { APIRoute } from "astro";
import { getSessionFromCookie, deleteSession, clearSessionCookie } from "../../../lib/auth";

export const POST: APIRoute = async ({ request }) => {
  const token = getSessionFromCookie(request);
  if (token) {
    deleteSession(token);
  }

  const headers = new Headers({ Location: "/login" });
  clearSessionCookie(headers);

  return new Response(null, { status: 302, headers });
};
