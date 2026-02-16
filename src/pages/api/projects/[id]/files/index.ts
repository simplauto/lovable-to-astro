import type { APIRoute } from "astro";
import { readdir, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { projectOutputDir } from "../../../../../lib/converter/pipeline";

interface FileEntry {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  children?: FileEntry[];
}

async function buildTree(dir: string, rootDir: string): Promise<FileEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const result: FileEntry[] = [];

  // Trier : dossiers d'abord, puis fichiers, alphabétiquement
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, rootDir);
      result.push({
        path: relPath,
        name: entry.name,
        type: "directory",
        children,
      });
    } else {
      const stats = await stat(fullPath);
      result.push({
        path: relPath,
        name: entry.name,
        type: "file",
        size: stats.size,
      });
    }
  }

  return result;
}

export const GET: APIRoute = async ({ params }) => {
  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), { status: 400 });
  }

  const outputDir = projectOutputDir(projectId);

  try {
    const tree = await buildTree(outputDir, outputDir);
    return new Response(JSON.stringify(tree), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
