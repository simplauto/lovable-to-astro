import type { APIRoute } from "astro";
import { validateWebhookSignature } from "../../lib/github/webhook";
import { db } from "../../lib/db";
import { conversions } from "../../lib/db/schema";
import { runConversion } from "../../lib/converter/pipeline";

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

  const [conversion] = await db.insert(conversions).values({
    commitSha,
    commitMessage,
    branch,
    status: "pending",
    startedAt: new Date().toISOString(),
  }).returning();

  // Lancer la conversion en arrière-plan (non-bloquant)
  runConversion(conversion.id).catch((err) => {
    console.error(`Conversion ${conversion.id} failed:`, err);
  });

  return new Response(JSON.stringify({ conversionId: conversion.id }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
};
