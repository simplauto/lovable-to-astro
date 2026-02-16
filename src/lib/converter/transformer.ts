import { writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, extname } from "node:path";
import type { ConversionRule } from "../../types";

/**
 * Calcule le nom du composant à partir du chemin de fichier.
 * Ex: "src/pages/Dashboard.tsx" → "Dashboard"
 *     "src/pages/auth/login.tsx" → "Login"
 */
function componentNameFromPath(filePath: string): string {
  const base = basename(filePath).replace(extname(filePath), "");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Calcule le chemin d'import depuis une page Astro (src/pages/) vers un composant React (src/components/).
 *
 * Convention : les composants React du repo Lovable sont copiés dans src/components/
 * du projet Astro de sortie. Depuis src/pages/foo.astro, l'import est ../components/Foo.
 * Depuis src/pages/sub/bar.astro, l'import est ../../components/Bar.
 */
function computeImportPath(astroPageRelPath: string, componentSourcePath: string): string {
  const componentName = basename(componentSourcePath).replace(extname(componentSourcePath), "");

  // Compter le nombre de niveaux sous src/pages/
  // astroPageRelPath est quelque chose comme "index.astro" ou "sub/bar.astro"
  const depth = astroPageRelPath.split("/").length - 1;
  const upLevels = "../".repeat(depth + 1); // +1 pour remonter de pages/ vers src/

  return `${upLevels}components/${componentName}`;
}

/**
 * Génère un fichier .astro page à partir d'un composant React page.
 *
 * @param componentPath — chemin du composant React source (ex: "src/pages/Dashboard.tsx")
 * @param rule — règle de conversion à appliquer
 * @param astroPageRelPath — chemin relatif de la page Astro dans src/pages/ (ex: "dashboard.astro", "sub/page.astro")
 */
export function generateAstroPage(
  componentPath: string,
  rule: ConversionRule,
  astroPageRelPath: string,
): string {
  const componentName = componentNameFromPath(componentPath);
  const importPath = computeImportPath(astroPageRelPath, componentPath);

  if (rule.mode === "static") {
    return `---
import Layout from "../layouts/Layout.astro";
import ${componentName} from "${importPath}";
---

<Layout title="${componentName}">
  <${componentName} />
</Layout>
`;
  }

  // Composant en îlot React
  const directive = rule.hydrationDirective ?? "client:load";
  return `---
import Layout from "../layouts/Layout.astro";
import ${componentName} from "${importPath}";
---

<Layout title="${componentName}">
  <${componentName} ${directive} />
</Layout>
`;
}

/**
 * Écrit un fichier en créant les répertoires parents si nécessaire.
 */
export function writeOutput(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}
