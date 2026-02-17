import { writeOutput } from "./transformer";
import { join } from "node:path";
import { cpSync, existsSync, readFileSync } from "node:fs";

/** Dépendances à exclure du projet source (remplacées par Astro). */
const EXCLUDED_DEPS = [
  "react-scripts", "vite", "@vitejs/plugin-react",
  "@types/node", "eslint", "prettier", "postcss",
  "autoprefixer", "tailwindcss", // remplacé par la version Astro
  "next-themes", "next", "next-auth", // packages Next.js incompatibles Astro
];

/**
 * Lit les dépendances du package.json source et les fusionne avec celles d'Astro.
 */
function mergeSourceDeps(sourceDir: string): { dependencies: Record<string, string>; devDependencies: Record<string, string> } {
  const astroDeps: Record<string, string> = {
    astro: "^5.0.0",
    "@astrojs/react": "^4.0.0",
    react: "^19.0.0",
    "react-dom": "^19.0.0",
    tailwindcss: "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
  };

  const astroDevDeps: Record<string, string> = {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    typescript: "^5.0.0",
  };

  try {
    const sourcePkg = JSON.parse(readFileSync(join(sourceDir, "package.json"), "utf-8"));
    const srcDeps = sourcePkg.dependencies ?? {};
    const srcDevDeps = sourcePkg.devDependencies ?? {};

    // Fusionner les dépendances source (sauf celles exclues et celles déjà dans Astro)
    for (const [name, version] of Object.entries(srcDeps) as [string, string][]) {
      if (!EXCLUDED_DEPS.includes(name) && !astroDeps[name]) {
        astroDeps[name] = version;
      }
    }
    for (const [name, version] of Object.entries(srcDevDeps) as [string, string][]) {
      if (!EXCLUDED_DEPS.includes(name) && !astroDevDeps[name] && !astroDeps[name]) {
        astroDevDeps[name] = version;
      }
    }
  } catch {
    // Pas de package.json source, on continue avec les deps de base
  }

  return { dependencies: astroDeps, devDependencies: astroDevDeps };
}

/**
 * Génère le scaffold de base d'un projet Astro dans le répertoire de sortie.
 * Inclut package.json, astro.config, tsconfig, layout de base et styles.
 */
export function generateScaffold(outputDir: string, sourceDir: string): void {
  const { dependencies, devDependencies } = mergeSourceDeps(sourceDir);

  // package.json
  writeOutput(
    join(outputDir, "package.json"),
    JSON.stringify(
      {
        name: "simplauto-astro",
        type: "module",
        version: "0.1.0",
        private: true,
        scripts: {
          dev: "astro dev",
          build: "astro build",
          preview: "astro preview",
        },
        dependencies,
        devDependencies,
      },
      null,
      2,
    ),
  );

  // astro.config.mjs
  writeOutput(
    join(outputDir, "astro.config.mjs"),
    `import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
`,
  );

  // tsconfig.json
  writeOutput(
    join(outputDir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "astro/tsconfigs/strict",
        compilerOptions: {
          baseUrl: ".",
          paths: { "@/*": ["src/*"] },
        },
      },
      null,
      2,
    ),
  );

  // Global CSS (Tailwind v4)
  writeOutput(join(outputDir, "src/styles/global.css"), '@import "tailwindcss";\n');

  // Layout de base
  writeOutput(
    join(outputDir, "src/layouts/Layout.astro"),
    `---
interface Props {
  title?: string;
}

const { title = "Simplauto" } = Astro.props;
---

<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="/src/styles/global.css" />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
`,
  );

  // Copier les composants React du projet source vers src/components/
  const srcComponents = join(sourceDir, "src", "components");
  const outComponents = join(outputDir, "src", "components");
  if (existsSync(srcComponents)) {
    cpSync(srcComponents, outComponents, { recursive: true });
  }

  // Copier les composants page (src/pages/ → src/components/ dans la sortie)
  // Chez Lovable, les composants page vivent dans src/pages/ (Index.tsx, About.tsx...)
  // Côté Astro, src/pages/ est réservé aux fichiers .astro, donc on les met dans src/components/
  const srcPages = join(sourceDir, "src", "pages");
  if (existsSync(srcPages)) {
    cpSync(srcPages, outComponents, { recursive: true });
  }

  // Copier les assets (images, fonts, etc.)
  const srcPublic = join(sourceDir, "public");
  const outPublic = join(outputDir, "public");
  if (existsSync(srcPublic)) {
    cpSync(srcPublic, outPublic, { recursive: true });
  }

  // Copier les styles existants
  const srcStyles = join(sourceDir, "src", "styles");
  if (existsSync(srcStyles)) {
    cpSync(srcStyles, join(outputDir, "src", "styles"), { recursive: true });
  }

  // Copier les sous-dossiers source courants (lib, hooks, contexts, utils, etc.)
  for (const subDir of ["lib", "hooks", "contexts", "integrations", "utils", "services", "types", "data", "config", "assets"]) {
    const srcSub = join(sourceDir, "src", subDir);
    if (existsSync(srcSub)) {
      cpSync(srcSub, join(outputDir, "src", subDir), { recursive: true });
    }
  }
}
