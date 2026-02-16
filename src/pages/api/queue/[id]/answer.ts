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

  // Récupérer le projectId depuis la conversion associée
  const [conversion] = await db
    .select()
    .from(conversions)
    .where(eq(conversions.id, question.conversionId));

  const projectId = conversion?.projectId ?? null;

  const now = new Date().toISOString();

  // Mettre à jour la question
  await db
    .update(questions)
    .set({ answer, answeredAt: now })
    .where(eq(questions.id, id));

  // Déterminer le mode et la directive d'hydratation depuis la réponse
  // Valeurs possibles : "static", "static-data", "ssr", "island:client:load", "island:client:visible"
  let mode: "static" | "static-data" | "ssr" | "island";
  let hydrationDirective: "client:load" | "client:visible" | "client:idle" | "client:only" | null = null;

  if (answer.startsWith("island:")) {
    mode = "island";
    hydrationDirective = answer.replace("island:", "") as typeof hydrationDirective;
  } else if (answer === "static-data" || answer === "ssr") {
    mode = answer;
  } else {
    mode = "static";
  }

  // Chercher une règle existante pour ce composant + projet
  const existingRuleConditions = projectId
    ? and(eq(rules.componentPath, question.componentPath), eq(rules.projectId, projectId))
    : and(eq(rules.componentPath, question.componentPath), isNull(rules.projectId));

  const [existingRule] = await db
    .select()
    .from(rules)
    .where(existingRuleConditions);

  if (existingRule) {
    await db
      .update(rules)
      .set({ mode, hydrationDirective, updatedAt: now })
      .where(eq(rules.id, existingRule.id));
  } else {
    await db.insert(rules).values({
      projectId,
      componentPath: question.componentPath,
      mode,
      hydrationDirective,
      createdAt: now,
      updatedAt: now,
    });
  }

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
  if (remaining.length === 0 && conversion && conversion.status === "waiting_answers") {
    runConversion(conversion.id).catch((err) => {
      console.error(`Conversion ${conversion.id} resume failed:`, err);
    });
  }

  // Rediriger vers le dashboard du projet
  const redirectUrl = projectId ? `/project/${projectId}` : "/";
  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl },
  });
};
