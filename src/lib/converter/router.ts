import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import type * as t from "@babel/types";

const traverse = (typeof _traverse === "function" ? _traverse : (_traverse as any).default) as typeof _traverse;

export interface RouteDefinition {
  path: string;
  componentImport: string;
  componentName: string;
  astroPagePath: string;
}

/**
 * Extrait les définitions de routes depuis un fichier de routing React Router.
 * Supporte les patterns courants : <Route path="..." element={<Component />} />
 * et les objets createBrowserRouter.
 */
export function extractRoutes(source: string): RouteDefinition[] {
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const routes: RouteDefinition[] = [];
  const imports = new Map<string, string>();

  traverse(ast, {
    // Collecter les imports pour résoudre les noms de composants
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const source = path.node.source.value;
      for (const specifier of path.node.specifiers) {
        if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportSpecifier") {
          imports.set(specifier.local.name, source);
        }
      }
    },

    // Détecter <Route path="..." element={<Component />} />
    JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
      const name = path.node.name;
      if (name.type !== "JSXIdentifier" || name.name !== "Route") return;

      let routePath: string | null = null;
      let componentName: string | null = null;

      for (const attr of path.node.attributes) {
        if (attr.type !== "JSXAttribute" || attr.name.type !== "JSXIdentifier") continue;

        if (attr.name.name === "path" && attr.value?.type === "StringLiteral") {
          routePath = attr.value.value;
        }

        if (attr.name.name === "element" && attr.value?.type === "JSXExpressionContainer") {
          const expr = attr.value.expression;
          if (expr.type === "JSXElement" && expr.openingElement.name.type === "JSXIdentifier") {
            componentName = expr.openingElement.name.name;
          }
        }
      }

      if (routePath && componentName) {
        const componentImport = imports.get(componentName) ?? componentName;
        routes.push({
          path: routePath,
          componentImport,
          componentName,
          astroPagePath: routePathToAstroPath(routePath),
        });
      }
    },
  });

  return routes;
}

/**
 * Convertit un path React Router en path de fichier Astro.
 * Ex: "/" → "index.astro", "/about" → "about.astro", "/users/:id" → "users/[id].astro"
 */
function routePathToAstroPath(routePath: string): string {
  if (routePath === "/" || routePath === "") return "index.astro";

  return (
    routePath
      .replace(/^\//, "")
      .replace(/:(\w+)/g, "[$1]")    // :id → [id]
      .replace(/\*$/, "[...slug]")    // * → [...slug]
    + ".astro"
  );
}
