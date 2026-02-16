import type { APIRoute } from "astro";
import { deployCoolify } from "../../lib/coolify/client";

export const POST: APIRoute = async ({ request }) => {
  const { target } = await request.json();

  if (target !== "preview" && target !== "prod") {
    return new Response("Invalid target", { status: 400 });
  }

  try {
    await deployCoolify(target);
    return new Response(JSON.stringify({ ok: true, target }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
