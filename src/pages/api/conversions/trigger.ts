import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { conversions } from "../../../lib/db/schema";
import { runConversion } from "../../../lib/converter/pipeline";

/** POST /api/conversions/trigger — Déclencher une conversion manuelle */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { commitSha, commitMessage, branch } = body;

  if (!commitSha) {
    return new Response(JSON.stringify({ error: "commitSha required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [conversion] = await db
    .insert(conversions)
    .values({
      commitSha,
      commitMessage: commitMessage ?? "manual trigger",
      branch: branch ?? "main",
      status: "pending",
      startedAt: new Date().toISOString(),
    })
    .returning();

  runConversion(conversion.id).catch((err) => {
    console.error(`Manual conversion ${conversion.id} failed:`, err);
  });

  return new Response(JSON.stringify({ conversionId: conversion.id }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
};
