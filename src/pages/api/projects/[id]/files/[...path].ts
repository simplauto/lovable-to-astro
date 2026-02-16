import type { APIRoute } from "astro";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { projectOutputDir } from "../../../../../lib/converter/pipeline";

const MIME_TYPES: Record<string, string> = {
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".js": "text/javascript",
  ".jsx": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".html": "text/html",
  ".astro": "text/plain",
  ".md": "text/markdown",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

export const GET: APIRoute = async ({ params }) => {
  const projectId = Number(params.id);
  const filePath = params.path;

  if (isNaN(projectId) || !filePath) {
    return new Response(JSON.stringify({ error: "Invalid parameters" }), { status: 400 });
  }

  // Sécurité : empêcher la traversée de répertoire
  if (filePath.includes("..")) {
    return new Response(JSON.stringify({ error: "Invalid path" }), { status: 400 });
  }

  const outputDir = projectOutputDir(projectId);
  const fullPath = join(outputDir, filePath);

  try {
    const ext = extname(filePath);
    const isText = !ext || [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".css", ".html", ".astro", ".md", ".svg", ".txt", ".yml", ".yaml", ".toml"].includes(ext);

    if (isText) {
      const content = await readFile(fullPath, "utf-8");
      return new Response(JSON.stringify({ path: filePath, content }), {
        headers: { "Content-Type": "application/json" },
      });
    } else {
      const buffer = await readFile(fullPath);
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      return new Response(buffer, {
        headers: { "Content-Type": mime },
      });
    }
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
