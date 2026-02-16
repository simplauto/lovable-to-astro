import type { APIRoute } from "astro";
import { validateWebhookSignature } from "../../lib/github/webhook";
import { db } from "../../lib/db";
import { conversions, projects } from "../../lib/db/schema";
import { runConversion } from "../../lib/converter/pipeline";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";

  if (!validateWebhookSignature(body, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event !== "push") {
    return new Response("Ignored event: " + event, { status: 200 });
  }

  const payload = JSON.parse(body);
  const commitSha = payload.after;
  const commitMessage = payload.head_commit?.message ?? null;
  const branch = payload.ref?.replace("refs/heads/", "") ?? "main";
  const repoFullName = payload.repository?.full_name;

  // Match webhook to a project by source repo
  let projectId: number | null = null;
  if (repoFullName) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.sourceRepo, repoFullName));
    if (project) {
      projectId = project.id;
    }
  }

  const [conversion] = await db.insert(conversions).values({
    commitSha,
    commitMessage,
    branch,
    projectId,
    status: "pending",
    startedAt: new Date().toISOString(),
  }).returning();

  // Lancer la conversion en arrière-plan (non-bloquant)
  runConversion(conversion.id).catch((err) => {
    console.error(`Conversion ${conversion.id} failed:`, err);
  });

  return new Response(JSON.stringify({ conversionId: conversion.id, projectId }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
};
