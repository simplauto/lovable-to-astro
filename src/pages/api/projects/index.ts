import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { projects } from "../../../lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { conversions, questions } from "../../../lib/db/schema";

export const GET: APIRoute = async () => {
  const allProjects = db
    .select({
      id: projects.id,
      name: projects.name,
      sourceRepo: projects.sourceRepo,
      targetRepo: projects.targetRepo,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      conversionCount: sql<number>`(SELECT COUNT(*) FROM conversions WHERE project_id = ${projects.id})`,
      pendingQuestions: sql<number>`(SELECT COUNT(*) FROM questions q JOIN conversions c ON q.conversion_id = c.id WHERE c.project_id = ${projects.id} AND q.answer IS NULL)`,
      lastStatus: sql<string>`(SELECT status FROM conversions WHERE project_id = ${projects.id} ORDER BY started_at DESC LIMIT 1)`,
    })
    .from(projects)
    .orderBy(desc(projects.updatedAt))
    .all();

  return new Response(JSON.stringify(allProjects), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { name, sourceRepo, targetRepo } = body;

  if (!name || !sourceRepo) {
    return new Response(JSON.stringify({ error: "name and sourceRepo are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = new Date().toISOString();
  const result = db
    .insert(projects)
    .values({ name, sourceRepo, targetRepo: targetRepo || null, createdAt: now, updatedAt: now })
    .returning()
    .get();

  return new Response(JSON.stringify(result), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
