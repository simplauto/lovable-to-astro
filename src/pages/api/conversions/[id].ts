import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { conversions, questions } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";

/** GET /api/conversions/:id — Détail d'une conversion avec ses questions */
export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response("Invalid ID", { status: 400 });
  }

  const [conversion] = await db
    .select()
    .from(conversions)
    .where(eq(conversions.id, id));

  if (!conversion) {
    return new Response("Not found", { status: 404 });
  }

  const relatedQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.conversionId, id));

  return new Response(
    JSON.stringify({ ...conversion, questions: relatedQuestions }),
    { headers: { "Content-Type": "application/json" } },
  );
};
