import type { APIRoute } from "astro";
import { db } from "../../../../lib/db";
import { questions, rules, conversions } from "../../../../lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { runConversion } from "../../../../lib/converter/pipeline";

export const POST: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response("Invalid ID", { status: 400 });
  }

  const formData = await request.formData();
  const answer = formData.get("answer") as string;
  if (!answer) {
    return new Response("Missing answer", { status: 400 });
  }

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, id));

  if (!question) {
    return new Response("Question not found", { status: 404 });
  }

  const now = new Date().toISOString();

  // Mettre à jour la question
  await db
    .update(questions)
    .set({ answer, answeredAt: now })
    .where(eq(questions.id, id));

  // Créer ou mettre à jour la règle correspondante
  const isIsland = answer.startsWith("island:");
  const mode = isIsland ? "island" as const : "static" as const;
  const hydrationDirective = isIsland
    ? (answer.replace("island:", "") as "client:load" | "client:visible" | "client:idle" | "client:only")
    : null;

  await db
    .insert(rules)
    .values({
      componentPath: question.componentPath,
      mode,
      hydrationDirective,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: rules.componentPath,
      set: { mode, hydrationDirective, updatedAt: now },
    });

  // Vérifier s'il reste des questions non répondues pour cette conversion
  const remaining = await db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.conversionId, question.conversionId),
        isNull(questions.answeredAt),
      ),
    );

  // Si toutes les questions sont répondues, relancer la conversion
  if (remaining.length === 0) {
    const [conversion] = await db
      .select()
      .from(conversions)
      .where(eq(conversions.id, question.conversionId));

    if (conversion && conversion.status === "waiting_answers") {
      runConversion(conversion.id).catch((err) => {
        console.error(`Conversion ${conversion.id} resume failed:`, err);
      });
    }
  }

  // Rediriger vers la file d'attente
  return new Response(null, {
    status: 302,
    headers: { Location: "/queue" },
  });
};
