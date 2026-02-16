import type { APIRoute } from "astro";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { projectOutputDir } from "../../../../../lib/converter/pipeline";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export const GET: APIRoute = async ({ params }) => {
  const projectId = Number(params.id);
  let filePath = params.path || "index.html";

  if (isNaN(projectId)) {
    return new Response("Invalid ID", { status: 400 });
  }

  // Sécurité : empêcher la traversée de répertoire
  if (filePath.includes("..")) {
    return new Response("Invalid path", { status: 400 });
  }

  const distDir = join(projectOutputDir(projectId), "dist");

  // Essayer le chemin tel quel, puis avec /index.html
  let fullPath = join(distDir, filePath);
  try {
    const s = await stat(fullPath);
    if (s.isDirectory()) {
      fullPath = join(fullPath, "index.html");
    }
  } catch {
    // Si le fichier n'existe pas sans extension, essayer avec .html
    if (!extname(filePath)) {
      fullPath = join(distDir, filePath + ".html");
    }
  }

  try {
    const ext = extname(fullPath);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const isText = [".html", ".css", ".js", ".mjs", ".json", ".svg"].includes(ext);

    if (isText) {
      let content = await readFile(fullPath, "utf-8");

      // Pour les fichiers HTML, réécrire les chemins des assets
      // pour passer par notre endpoint de preview
      if (ext === ".html") {
        const basePath = `/api/projects/${projectId}/preview`;
        content = content.replace(/(href|src)="\/(?!\/)/g, `$1="${basePath}/`);
      }

      return new Response(content, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "no-cache",
        },
      });
    } else {
      const buffer = await readFile(fullPath);
      return new Response(buffer, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  } catch {
    return new Response("Not found", { status: 404 });
  }
};
