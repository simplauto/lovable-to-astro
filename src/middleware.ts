import { defineMiddleware } from "astro:middleware";
import { getSessionFromCookie, validateSession } from "./lib/auth";

const PUBLIC_PATHS = ["/login", "/api/webhook", "/api/auth/"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Let public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return next();
  }

  // Let static assets through
  if (pathname.startsWith("/_astro/") || pathname.startsWith("/favicon")) {
    return next();
  }

  // Check session
  const token = getSessionFromCookie(context.request);
  if (token) {
    const user = validateSession(token);
    if (user) {
      context.locals.user = user;
      return next();
    }
  }

  // Not authenticated → redirect to login
  return context.redirect("/login");
});
