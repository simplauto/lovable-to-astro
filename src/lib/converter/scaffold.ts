import { writeOutput } from "./transformer";
import { join } from "node:path";
import { cpSync, existsSync } from "node:fs";

/**
 * Génère le scaffold de base d'un projet Astro dans le répertoire de sortie.
 * Inclut package.json, astro.config, tsconfig, layout de base et styles.
 */
export function generateScaffold(outputDir: string, sourceDir: string): void {
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
        dependencies: {
          astro: "^5.0.0",
          "@astrojs/react": "^4.0.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          tailwindcss: "^4.0.0",
          "@tailwindcss/vite": "^4.0.0",
        },
        devDependencies: {
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          typescript: "^5.0.0",
        },
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

  // Copier lib/ (hooks, utils, api clients, etc.)
  const srcLib = join(sourceDir, "src", "lib");
  if (existsSync(srcLib)) {
    cpSync(srcLib, join(outputDir, "src", "lib"), { recursive: true });
  }

  // Copier hooks/
  const srcHooks = join(sourceDir, "src", "hooks");
  if (existsSync(srcHooks)) {
    cpSync(srcHooks, join(outputDir, "src", "hooks"), { recursive: true });
  }

  // Copier contexts/
  const srcContexts = join(sourceDir, "src", "contexts");
  if (existsSync(srcContexts)) {
    cpSync(srcContexts, join(outputDir, "src", "contexts"), { recursive: true });
  }
}
