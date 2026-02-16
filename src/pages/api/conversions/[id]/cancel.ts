import type { APIRoute } from "astro";
import { db } from "../../../../lib/db";
import { conversions } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), { status: 400 });
  }

  const [conversion] = await db.select().from(conversions).where(eq(conversions.id, id));
  if (!conversion) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  // Marquer comme erreur si en cours
  if (!["done", "error"].includes(conversion.status)) {
    await db
      .update(conversions)
      .set({
        status: "error",
        errorMessage: "Annulé manuellement",
        finishedAt: new Date().toISOString(),
      })
      .where(eq(conversions.id, id));
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
