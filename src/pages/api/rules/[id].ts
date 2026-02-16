import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { rules } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";

/** DELETE /api/rules/:id — Supprimer une règle */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response("Invalid ID", { status: 400 });
  }

  await db.delete(rules).where(eq(rules.id, id));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

/** PATCH /api/rules/:id — Modifier une règle */
export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response("Invalid ID", { status: 400 });
  }

  const body = await request.json();
  const { mode, hydrationDirective, notes } = body;

  const [updated] = await db
    .update(rules)
    .set({
      ...(mode !== undefined ? { mode } : {}),
      ...(hydrationDirective !== undefined ? { hydrationDirective } : {}),
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(rules.id, id))
    .returning();

  if (!updated) {
    return new Response("Rule not found", { status: 404 });
  }

  return new Response(JSON.stringify(updated), {
    headers: { "Content-Type": "application/json" },
  });
};
