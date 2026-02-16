import type { APIRoute } from "astro";
import { Octokit } from "@octokit/rest";

export const GET: APIRoute = async () => {
  const token = process.env.GITHUB_TOKEN ?? import.meta.env.GITHUB_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const octokit = new Octokit({ auth: token });

  try {
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
      type: "all",
    });

    const repos = data.map((r) => ({
      fullName: r.full_name,
      name: r.name,
      description: r.description,
      isPrivate: r.private,
      updatedAt: r.updated_at,
    }));

    return new Response(JSON.stringify(repos), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
