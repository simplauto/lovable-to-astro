import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { rules } from "../../../lib/db/schema";
import { asc } from "drizzle-orm";

/** GET /api/rules — Liste toutes les règles */
export const GET: APIRoute = async () => {
  const allRules = await db.select().from(rules).orderBy(asc(rules.componentPath));
  return new Response(JSON.stringify(allRules), {
    headers: { "Content-Type": "application/json" },
  });
};

/** POST /api/rules — Créer une règle */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { componentPath, mode, hydrationDirective, notes, projectId } = body;

  if (!componentPath || !mode) {
    return new Response(JSON.stringify({ error: "componentPath and mode required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = new Date().toISOString();

  const [rule] = await db
    .insert(rules)
    .values({
      componentPath,
      mode,
      hydrationDirective: hydrationDirective ?? null,
      notes: notes ?? null,
      projectId: projectId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return new Response(JSON.stringify(rule), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
