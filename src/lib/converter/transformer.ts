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
/**
 * Calcule le préfixe de remontée "../" depuis une page Astro vers src/.
 * Ex: "index.astro" → "../", "sub/bar.astro" → "../../"
 */
function upFromPages(astroPageRelPath: string): string {
  const depth = astroPageRelPath.split("/").length - 1;
  return "../".repeat(depth + 1); // +1 pour remonter de pages/ vers src/
}

function computeImportPath(astroPageRelPath: string, componentSourcePath: string): string {
  const componentName = basename(componentSourcePath).replace(extname(componentSourcePath), "");
  return `${upFromPages(astroPageRelPath)}components/${componentName}`;
}

function computeLayoutPath(astroPageRelPath: string): string {
  return `${upFromPages(astroPageRelPath)}layouts/Layout.astro`;
}

/**
 * Génère le wrapper React pour une page (BrowserRouter + composant).
 * Un seul composant client:only dans le template Astro évite les problèmes
 * de slot SSR — Astro n'essaie pas de server-render les enfants.
 */
export function generatePageWrapper(componentName: string): string {
  return `import { BrowserRouter } from "react-router-dom";
import ${componentName} from "./${componentName}";

export default function ${componentName}Page() {
  return (
    <BrowserRouter>
      <${componentName} />
    </BrowserRouter>
  );
}
`;
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
  const layoutPath = computeLayoutPath(astroPageRelPath);

  // Le wrapper React (BrowserRouter + composant) est un seul client:only island.
  // Pas de composant React enfant dans le template Astro → pas de problème SSR.
  const wrapperPath = `${upFromPages(astroPageRelPath)}components/${componentName}Page`;

  return `---
import Layout from "${layoutPath}";
import ${componentName}Page from "${wrapperPath}";
---

<Layout title="${componentName}">
  <${componentName}Page client:only="react" />
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
