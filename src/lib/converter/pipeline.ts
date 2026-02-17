import { mkdtemp, readdir, readFile, rm, cp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, extname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
import { db } from "../db";
import { conversions, questions, projects } from "../db/schema";
import { eq } from "drizzle-orm";
import { cloneSourceRepo } from "../github/client";
import { analyzeComponent } from "./analyzer";
import { findRule, needsQuestion } from "../rules/engine";
import { suggestHydrationDirective } from "./islands";
import { generateAstroPage, writeOutput } from "./transformer";
import { extractRoutes } from "./router";
import { generateScaffold } from "./scaffold";
import type { ComponentAnalysis, ConversionRule, ConversionStatus } from "../../types";

/** Répertoire persistant pour les fichiers générés d'un projet. */
export function projectOutputDir(projectId: number): string {
  return join(process.cwd(), "data", "projects", String(projectId), "output");
}

async function updateStatus(id: number, status: ConversionStatus, errorMessage?: string) {
  await db
    .update(conversions)
    .set({
      status,
      ...(errorMessage ? { errorMessage } : {}),
      ...(status === "done" || status === "error" ? { finishedAt: new Date().toISOString() } : {}),
    })
    .where(eq(conversions.id, id));
}

/**
 * Collecte récursivement les fichiers React (.tsx/.jsx) d'un répertoire.
 */
async function collectReactFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      files.push(...(await collectReactFiles(fullPath)));
    } else if (entry.isFile() && [".tsx", ".jsx"].includes(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Pipeline principal de conversion.
 */
export async function runConversion(conversionId: number): Promise<void> {
  const sourceDir = await mkdtemp(join(tmpdir(), "lovable-src-"));
  const outputDir = await mkdtemp(join(tmpdir(), "astro-out-"));
  const t0 = Date.now();
  const log = (msg: string) => console.log(`[conv:${conversionId}] ${msg} (+${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  try {
    // 0. Charger le projet associé
    log("Chargement du projet...");
    const [conversion0] = await db
      .select()
      .from(conversions)
      .where(eq(conversions.id, conversionId));

    let sourceRepo: string | undefined;
    if (conversion0?.projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, conversion0.projectId));
      if (project) {
        sourceRepo = project.sourceRepo;
      }
    }

    // 1. Clone
    log(`Clone du repo ${sourceRepo ?? "(aucun)"}...`);
    await updateStatus(conversionId, "analyzing");
    await cloneSourceRepo(sourceDir, sourceRepo);
    log("Clone terminé.");

    // 2. Analyse des composants
    const srcDir = join(sourceDir, "src");
    const reactFiles = await collectReactFiles(srcDir);
    log(`${reactFiles.length} fichiers React trouvés.`);
    const analyses: ComponentAnalysis[] = [];
    const pendingQuestions: { componentPath: string; analysis: ComponentAnalysis }[] = [];

    for (const filePath of reactFiles) {
      const source = await readFile(filePath, "utf-8");
      const relativePath = relative(sourceDir, filePath);
      const analysis = analyzeComponent(relativePath, source);
      analyses.push(analysis);

      const existingRule = await findRule(relativePath, conversion0?.projectId ?? undefined);
      if (!existingRule && needsQuestion(analysis)) {
        pendingQuestions.push({ componentPath: relativePath, analysis });
      }
    }
    log(`Analyse terminée : ${analyses.length} composants, ${pendingQuestions.length} questions.`);

    // 3. S'il y a des questions, les créer et mettre en pause
    if (pendingQuestions.length > 0) {
      await updateStatus(conversionId, "waiting_answers");
      log("Questions en attente, conversion en pause.");

      for (const { componentPath, analysis } of pendingQuestions) {
        const suggested = suggestHydrationDirective(analysis);
        const hooksList = analysis.hooks.length > 0 ? analysis.hooks.join(", ") : "aucun";
        const details: string[] = [];
        if (analysis.hasHooks) details.push(`hooks: ${hooksList}`);
        if (analysis.hasEventHandlers) details.push("gestionnaires d'événements");
        if (analysis.usesContext) details.push("React Context");
        if (analysis.usesRouter) details.push("routeur React");
        const detailStr = details.length > 0 ? details.join(", ") : "composant simple";

        const modeLabels: Record<string, string> = {
          static: "Statique (HTML pur)",
          "static-data": "Statique + données",
          ssr: "SSR (serveur)",
          island: `Interactif (${suggested})`,
        };
        const suggestionLabel = modeLabels[analysis.suggestedMode] ?? analysis.suggestedMode;

        await db.insert(questions).values({
          conversionId,
          componentPath,
          questionText: `Quel mode pour ce composant ? Détecté : ${detailStr}. Suggestion : ${suggestionLabel}.`,
          context: JSON.stringify(analysis, null, 2),
          createdAt: new Date().toISOString(),
        });
      }

      return;
    }

    // 4. Conversion
    await updateStatus(conversionId, "converting");
    log("Génération du scaffold Astro...");
    generateScaffold(outputDir, sourceDir);

    const routingFiles = reactFiles.filter(
      (f) => f.includes("App.tsx") || f.includes("router") || f.includes("routes"),
    );
    log(`${routingFiles.length} fichier(s) de routing détecté(s).`);

    for (const routeFile of routingFiles) {
      const source = await readFile(routeFile, "utf-8");
      const routes = extractRoutes(source);
      log(`  ${relative(sourceDir, routeFile)} → ${routes.length} route(s): ${routes.map((r) => r.astroPagePath).join(", ")}`);

      for (const route of routes) {
        const analysis = analyses.find((a) => a.filePath.includes(route.componentName));
        const rule: ConversionRule = (await findRule(route.componentImport, conversion0?.projectId ?? undefined)) ?? {
          componentPath: route.componentImport,
          mode: analysis?.suggestedMode ?? "island",
          hydrationDirective: analysis?.suggestedDirective ?? "client:load",
        };

        const astroPagePath = join(outputDir, "src", "pages", route.astroPagePath);
        const astroContent = generateAstroPage(
          route.componentImport,
          rule,
          route.astroPagePath,
        );

        writeOutput(astroPagePath, astroContent);
      }
    }
    log("Conversion terminée.");

    // 5. Copier les fichiers générés vers le répertoire persistant du projet
    await updateStatus(conversionId, "pushing");
    log("Copie des fichiers vers le répertoire persistant...");

    if (conversion0?.projectId) {
      const destDir = projectOutputDir(conversion0.projectId);
      await rm(destDir, { recursive: true, force: true }).catch(() => {});
      await mkdir(destDir, { recursive: true });
      await cp(outputDir, destDir, { recursive: true });
      log("Copie terminée.");

      // 6. Build du projet Astro pour preview
      await updateStatus(conversionId, "deploying");
      const buildLogPath = join(destDir, "build.log");
      const execOpts = { cwd: destDir, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 };
      try {
        log("npm install (timeout 2min)...");
        const installResult = await exec("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps"], execOpts);
        log("npm install OK.");

        const astroBin = join(destDir, "node_modules", ".bin", "astro");
        log("astro build (timeout 2min)...");
        const buildResult = await exec(astroBin, ["build"], execOpts);
        log("astro build OK.");

        const buildLog = [
          "=== npm install ===",
          installResult.stdout,
          installResult.stderr,
          "=== astro build ===",
          buildResult.stdout,
          buildResult.stderr,
          "=== BUILD OK ===",
        ].filter(Boolean).join("\n");
        await writeFile(buildLogPath, buildLog, "utf-8");
      } catch (buildErr: any) {
        log(`Build preview échoué : ${buildErr.message || buildErr}`);
        const errorLog = [
          "=== BUILD FAILED ===",
          buildErr.stdout || "",
          buildErr.stderr || "",
          buildErr.message || String(buildErr),
        ].filter(Boolean).join("\n");
        await writeFile(buildLogPath, errorLog, "utf-8");
      }
    }

    await updateStatus(conversionId, "done");
    log("Conversion terminée avec succès !");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log(`ERREUR : ${message}`);
    await updateStatus(conversionId, "error", message);
    throw err;
  } finally {
    await rm(sourceDir, { recursive: true, force: true }).catch(() => {});
    await rm(outputDir, { recursive: true, force: true }).catch(() => {});
    log("Nettoyage terminé.");
  }
}
