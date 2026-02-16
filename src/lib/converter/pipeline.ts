import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, extname } from "node:path";
import { db } from "../db";
import { conversions, questions } from "../db/schema";
import { eq } from "drizzle-orm";
import { cloneSourceRepo, pushToTargetRepo } from "../github/client";
import { deployCoolify } from "../coolify/client";
import { analyzeComponent } from "./analyzer";
import { findRule, needsQuestion } from "../rules/engine";
import { suggestHydrationDirective } from "./islands";
import { generateAstroPage, writeOutput } from "./transformer";
import { extractRoutes } from "./router";
import { generateScaffold } from "./scaffold";
import type { ComponentAnalysis, ConversionRule, ConversionStatus } from "../../types";

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

  try {
    // 1. Clone
    await updateStatus(conversionId, "analyzing");
    await cloneSourceRepo(sourceDir);

    // 2. Analyse des composants
    const srcDir = join(sourceDir, "src");
    const reactFiles = await collectReactFiles(srcDir);
    const analyses: ComponentAnalysis[] = [];
    const pendingQuestions: { componentPath: string; analysis: ComponentAnalysis }[] = [];

    for (const filePath of reactFiles) {
      const source = await readFile(filePath, "utf-8");
      const relativePath = relative(sourceDir, filePath);
      const analysis = analyzeComponent(relativePath, source);
      analyses.push(analysis);

      // Vérifier s'il y a une règle existante
      const existingRule = await findRule(relativePath);
      if (!existingRule && needsQuestion(analysis)) {
        pendingQuestions.push({ componentPath: relativePath, analysis });
      }
    }

    // 3. S'il y a des questions, les créer et mettre en pause
    if (pendingQuestions.length > 0) {
      await updateStatus(conversionId, "waiting_answers");

      for (const { componentPath, analysis } of pendingQuestions) {
        const suggested = suggestHydrationDirective(analysis);
        await db.insert(questions).values({
          conversionId,
          componentPath,
          questionText: `Comment convertir ${componentPath} ? Hooks détectés : ${analysis.hooks.join(", ") || "aucun"}. Suggestion : ${analysis.suggestedMode} (${suggested})`,
          context: JSON.stringify(analysis, null, 2),
          createdAt: new Date().toISOString(),
        });
      }

      // La conversion reprendra quand toutes les questions auront été répondues
      return;
    }

    // 4. Conversion
    await updateStatus(conversionId, "converting");

    // Générer le scaffold du projet Astro (config, layout, copie des assets et composants)
    generateScaffold(outputDir, sourceDir);

    // Chercher le fichier de routing
    const routingFiles = reactFiles.filter(
      (f) => f.includes("App.tsx") || f.includes("router") || f.includes("routes"),
    );

    for (const routeFile of routingFiles) {
      const source = await readFile(routeFile, "utf-8");
      const routes = extractRoutes(source);

      for (const route of routes) {
        const analysis = analyses.find((a) => a.filePath.includes(route.componentName));
        const rule: ConversionRule = (await findRule(route.componentImport)) ?? {
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

    // 5. Push vers le repo cible
    await updateStatus(conversionId, "pushing");

    const [conversion] = await db
      .select()
      .from(conversions)
      .where(eq(conversions.id, conversionId));

    await pushToTargetRepo(
      outputDir,
      `Convert ${conversion.commitSha.slice(0, 7)}: ${conversion.commitMessage ?? "auto-conversion"}`,
    );

    // 6. Déploiement preview automatique
    await updateStatus(conversionId, "deploying");
    await deployCoolify("preview");

    await updateStatus(conversionId, "done");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateStatus(conversionId, "error", message);
    throw err;
  } finally {
    // Nettoyage des répertoires temporaires
    await rm(sourceDir, { recursive: true, force: true }).catch(() => {});
    await rm(outputDir, { recursive: true, force: true }).catch(() => {});
  }
}
