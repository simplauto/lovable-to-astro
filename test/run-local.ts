/**
 * Script de test local : exécute l'analyse et la conversion sur le mock Lovable.
 * Ne nécessite ni GitHub ni Coolify.
 *
 * Usage: npx tsx test/run-local.ts
 */

import { readdir, readFile, rm, mkdir } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { analyzeComponent } from "../src/lib/converter/analyzer";
import { extractRoutes } from "../src/lib/converter/router";
import { suggestHydrationDirective } from "../src/lib/converter/islands";
import { generateAstroPage, writeOutput } from "../src/lib/converter/transformer";
import { generateScaffold } from "../src/lib/converter/scaffold";
import type { ComponentAnalysis, ConversionRule } from "../src/types";

const MOCK_DIR = join(import.meta.dirname, "mock-lovable");
const OUTPUT_DIR = join(import.meta.dirname, "output-astro");

async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      files.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile() && [".tsx", ".jsx", ".ts"].includes(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  console.log("=== Test local du pipeline lovable-to-astro ===\n");

  // Nettoyage
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  // 1. Collecter les fichiers
  const srcDir = join(MOCK_DIR, "src");
  const files = await collectFiles(srcDir);
  console.log(`Fichiers trouvés : ${files.length}`);
  files.forEach((f) => console.log(`  - ${relative(MOCK_DIR, f)}`));

  // 2. Analyser chaque composant
  console.log("\n--- Analyse des composants ---\n");
  const analyses: ComponentAnalysis[] = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf-8");
    const relativePath = relative(MOCK_DIR, filePath);
    const analysis = analyzeComponent(relativePath, source);
    analyses.push(analysis);

    const directive = analysis.suggestedDirective
      ? suggestHydrationDirective(analysis)
      : undefined;

    console.log(
      `${relativePath.padEnd(45)} → ${analysis.suggestedMode.padEnd(8)} ` +
      `${(directive ?? "—").padEnd(16)} ` +
      `confiance: ${analysis.confidence}` +
      (analysis.hooks.length > 0 ? ` | hooks: ${analysis.hooks.join(", ")}` : "") +
      (analysis.dependencies.filter((d) => !d.startsWith(".") && !d.startsWith("@/")).length > 0
        ? ` | deps: ${analysis.dependencies.filter((d) => !d.startsWith(".") && !d.startsWith("@/")).join(", ")}`
        : ""),
    );
  }

  // 3. Extraire les routes
  console.log("\n--- Extraction des routes ---\n");
  const appFile = files.find((f) => f.includes("App.tsx"));
  let routes: ReturnType<typeof extractRoutes> = [];

  if (appFile) {
    const source = await readFile(appFile, "utf-8");
    routes = extractRoutes(source);
    routes.forEach((r) => {
      console.log(`  ${r.path.padEnd(20)} → ${r.astroPagePath.padEnd(25)} (${r.componentName})`);
    });
  } else {
    console.log("  Aucun fichier App.tsx trouvé !");
  }

  // 4. Générer le scaffold
  console.log("\n--- Génération du scaffold ---\n");
  generateScaffold(OUTPUT_DIR, MOCK_DIR);
  console.log("  Scaffold généré dans", OUTPUT_DIR);

  // 5. Générer les pages Astro
  console.log("\n--- Génération des pages Astro ---\n");
  for (const route of routes) {
    const analysis = analyses.find((a) => a.filePath.includes(route.componentName));
    const rule: ConversionRule = {
      componentPath: route.componentImport,
      mode: analysis?.suggestedMode ?? "island",
      hydrationDirective: analysis?.suggestedDirective ?? "client:load",
    };

    const astroPagePath = join(OUTPUT_DIR, "src", "pages", route.astroPagePath);
    const content = generateAstroPage(route.componentImport, rule, route.astroPagePath);
    writeOutput(astroPagePath, content);

    console.log(`  ${route.astroPagePath.padEnd(25)} → mode: ${rule.mode}, directive: ${rule.hydrationDirective ?? "—"}`);
  }

  // 6. Lister les fichiers générés
  console.log("\n--- Fichiers générés ---\n");
  const outputFiles = await collectFiles(OUTPUT_DIR);
  // Ajouter les fichiers non-.ts aussi
  const allOutput = await collectAllFiles(OUTPUT_DIR);
  allOutput.forEach((f) => console.log(`  ${relative(OUTPUT_DIR, f)}`));

  console.log(`\nTotal : ${allOutput.length} fichiers générés`);
  console.log("\n=== Test terminé avec succès ===");
}

async function collectAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectAllFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

main().catch(console.error);
