import type { APIRoute } from "astro";
import { readFile, stat, readdir } from "node:fs/promises";
import { join, extname, relative } from "node:path";
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

/** Collecte récursivement les fichiers HTML dans dist/. */
async function collectHtmlFiles(dir: string, base: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith("_")) {
        results.push(...await collectHtmlFiles(full, base));
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        results.push(relative(base, full));
      }
    }
  } catch { /* ignore */ }
  return results;
}

/** Génère une page HTML d'index listant les pages disponibles. */
function generateIndexPage(pages: string[], basePath: string): string {
  const links = pages
    .sort()
    .map((p) => {
      const label = p.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
      return `<li><a href="${basePath}/${p}" style="color:#2563eb;text-decoration:underline">${label || "/"}</a></li>`;
    })
    .join("\n      ");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview — Pages disponibles</title></head>
<body style="font-family:system-ui;max-width:600px;margin:2rem auto;padding:0 1rem">
  <h1 style="font-size:1.25rem">Pages disponibles</h1>
  <ul style="line-height:2">${links}</ul>
</body>
</html>`;
}

export const GET: APIRoute = async ({ params }) => {
  const projectId = Number(params.id);
  let filePath = params.path || "index.html";

  if (isNaN(projectId)) {
    return new Response("Invalid ID", { status: 400 });
  }

  if (filePath.includes("..")) {
    return new Response("Invalid path", { status: 400 });
  }

  const distDir = join(projectOutputDir(projectId), "dist");
  const basePath = `/api/projects/${projectId}/preview`;

  // Essayer le chemin tel quel, puis avec /index.html
  let fullPath = join(distDir, filePath);
  try {
    const s = await stat(fullPath);
    if (s.isDirectory()) {
      fullPath = join(fullPath, "index.html");
    }
  } catch {
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

      if (ext === ".html") {
        content = content.replace(/(href|src)="\/(?!\/)/g, `$1="${basePath}/`);
      }

      return new Response(content, {
        headers: { "Content-Type": mime, "Cache-Control": "no-cache" },
      });
    } else {
      const buffer = await readFile(fullPath);
      return new Response(buffer, {
        headers: { "Content-Type": mime, "Cache-Control": "public, max-age=3600" },
      });
    }
  } catch {
    // Si index.html n'existe pas, afficher la liste des pages disponibles
    if (filePath === "index.html") {
      const pages = await collectHtmlFiles(distDir, distDir);
      if (pages.length > 0) {
        return new Response(generateIndexPage(pages, basePath), {
          headers: { "Content-Type": "text/html", "Cache-Control": "no-cache" },
        });
      }
    }
    return new Response("Not found", { status: 404 });
  }
};
