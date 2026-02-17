import type { APIRoute } from "astro";
import { readFile, stat, readdir } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { existsSync } from "node:fs";
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

/** Collecte récursivement tous les fichiers dans un répertoire. */
async function collectAllFiles(dir: string, base: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await collectAllFiles(full, base));
      } else if (entry.isFile()) {
        results.push(relative(base, full));
      }
    }
  } catch { /* ignore */ }
  return results;
}

/** Génère une page HTML d'index listant les pages disponibles. */
function generateIndexPage(htmlFiles: string[], allFiles: string[], basePath: string, distDir: string): string {
  const links = htmlFiles
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
  ${htmlFiles.length > 0
    ? `<ul style="line-height:2">${links}</ul>`
    : `<p style="color:#dc2626">Aucun fichier HTML trouvé dans dist/</p>`}
  <details style="margin-top:1rem">
    <summary style="cursor:pointer;color:#6b7280">Debug : ${allFiles.length} fichiers dans dist/</summary>
    <pre style="font-size:0.75rem;background:#f3f4f6;padding:1rem;border-radius:0.5rem;overflow:auto;max-height:400px">${
      allFiles.length > 0 ? allFiles.join("\n") : `(vide)\ndistDir: ${distDir}\nexists: ${existsSync(distDir)}`
    }</pre>
  </details>
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

  const outputDir = projectOutputDir(projectId);
  const distDir = join(outputDir, "dist");
  const basePath = `/api/projects/${projectId}/preview`;

  console.log(`[preview] projectId=${projectId} filePath="${filePath}" distDir="${distDir}" exists=${existsSync(distDir)}`);

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

  console.log(`[preview] trying fullPath="${fullPath}" exists=${existsSync(fullPath)}`);

  try {
    const ext = extname(fullPath);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const isText = [".html", ".css", ".js", ".mjs", ".json", ".svg"].includes(ext);

    if (isText) {
      let content = await readFile(fullPath, "utf-8");

      // Réécrire TOUTES les références à des chemins absolus (/, /_astro/, /src/, etc.)
      // pour passer par notre endpoint de preview
      if (ext === ".html") {
        // Couvre : href="/...", src="/...", import("/..."), fetch("/..."), url("/...")
        content = content.replaceAll('"/_astro/', `"${basePath}/_astro/`);
        content = content.replaceAll("'/_astro/", `'${basePath}/_astro/`);
        content = content.replace(/(href|src|action)="\/(?!\/)/g, `$1="${basePath}/`);
      }

      // Pour les fichiers JS, réécrire les imports dynamiques vers /_astro/
      if (ext === ".js" || ext === ".mjs") {
        content = content.replaceAll('"/_astro/', `"${basePath}/_astro/`);
        content = content.replaceAll("'/_astro/", `'${basePath}/_astro/`);
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
  } catch (err) {
    console.log(`[preview] file not found: ${fullPath} — error: ${err}`);

    // Si index.html n'existe pas, lister ce qui est disponible
    if (filePath === "index.html") {
      const allFiles = await collectAllFiles(distDir, distDir);
      const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));
      console.log(`[preview] fallback: ${allFiles.length} fichiers dans dist/, ${htmlFiles.length} HTML`);

      return new Response(generateIndexPage(htmlFiles, allFiles, basePath, distDir), {
        headers: { "Content-Type": "text/html", "Cache-Control": "no-cache" },
      });
    }
    return new Response("Not found", { status: 404 });
  }
};
