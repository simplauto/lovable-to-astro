import type { APIRoute } from "astro";
import { Octokit } from "@octokit/rest";
import { db } from "../../../lib/db";
import { conversions, projects } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { runConversion } from "../../../lib/converter/pipeline";

/** POST /api/conversions/trigger — Déclencher une conversion */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { projectId } = body;

  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Charger le projet
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) {
    return new Response(JSON.stringify({ error: "project not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Récupérer le dernier commit du repo source via GitHub API
  const token = process.env.GITHUB_TOKEN ?? import.meta.env.GITHUB_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const octokit = new Octokit({ auth: token });
  const [owner, repo] = project.sourceRepo.split("/");

  let commitSha: string;
  let commitMessage: string;
  let branch = "main";

  try {
    // Essayer main, puis master
    let ref: Awaited<ReturnType<typeof octokit.repos.getBranch>> | null = null;
    try {
      ref = await octokit.repos.getBranch({ owner, repo, branch: "main" });
    } catch {
      ref = await octokit.repos.getBranch({ owner, repo, branch: "master" });
      branch = "master";
    }
    commitSha = ref.data.commit.sha;
    commitMessage = ref.data.commit.commit.message ?? "auto";
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Cannot fetch latest commit: ${err.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [conversion] = await db
    .insert(conversions)
    .values({
      commitSha,
      commitMessage,
      branch,
      projectId,
      status: "pending",
      startedAt: new Date().toISOString(),
    })
    .returning();

  runConversion(conversion.id).catch((err) => {
    console.error(`Conversion ${conversion.id} failed:`, err);
  });

  return new Response(JSON.stringify({ conversionId: conversion.id }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
};
