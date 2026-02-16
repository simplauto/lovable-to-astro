import type { APIRoute } from "astro";
import { db } from "../../../../lib/db";
import { projects } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { name, targetRepo } = body;

  const updates: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (targetRepo !== undefined) updates.targetRepo = targetRepo;

  await db.update(projects).set(updates).where(eq(projects.id, id));

  const [updated] = await db.select().from(projects).where(eq(projects.id, id));

  return new Response(JSON.stringify(updated), {
    headers: { "Content-Type": "application/json" },
  });
};
