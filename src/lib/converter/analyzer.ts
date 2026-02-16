import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import type * as t from "@babel/types";
import type { ComponentAnalysis, ComponentMode, HydrationDirective } from "../../types";

// Handle ESM/CJS interop for @babel/traverse
const traverse = (typeof _traverse === "function" ? _traverse : (_traverse as any).default) as typeof _traverse;

const REACT_HOOKS = [
  "useState",
  "useEffect",
  "useCallback",
  "useMemo",
  "useRef",
  "useReducer",
  "useContext",
  "useLayoutEffect",
  "useImperativeHandle",
];

const INTERACTIVE_HOOKS = ["useState", "useEffect", "useReducer", "useCallback"];

/** Dépendances qui rendent un composant forcément interactif côté client. */
const CLIENT_ONLY_DEPS = [
  "@tanstack/react-query",
  "@supabase/auth-helpers-react",
  "react-hook-form",
  "framer-motion",
  "react-hot-toast",
  "sonner",
  "react-dropzone",
];

/** Dépendances purement UI qui restent statiques (shadcn/ui, radix, lucide). */
const STATIC_SAFE_PREFIXES = [
  "@radix-ui/",
  "lucide-react",
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
];

/**
 * Analyse un fichier React et détermine ses caractéristiques.
 */
export function analyzeComponent(filePath: string, source: string): ComponentAnalysis {
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const hooks: string[] = [];
  let hasEventHandlers = false;
  let usesContext = false;
  let usesRouter = false;
  let usesClientOnlyDep = false;
  let usesBrowserApi = false;
  const dependencies: string[] = [];

  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const callee = path.node.callee;
      if (callee.type === "Identifier") {
        if (REACT_HOOKS.includes(callee.name) || callee.name.startsWith("use")) {
          hooks.push(callee.name);
        }
        if (callee.name === "useContext") {
          usesContext = true;
        }
      }
    },

    // Détecter les accès à window, document, localStorage, sessionStorage
    MemberExpression(path: NodePath<t.MemberExpression>) {
      const obj = path.node.object;
      if (obj.type === "Identifier") {
        if (["window", "document", "localStorage", "sessionStorage", "navigator"].includes(obj.name)) {
          usesBrowserApi = true;
        }
      }
    },

    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const source = path.node.source.value;
      dependencies.push(source);

      if (source.includes("react-router")) {
        usesRouter = true;
      }

      if (CLIENT_ONLY_DEPS.some((dep) => source.startsWith(dep))) {
        usesClientOnlyDep = true;
      }
    },

    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      const name = path.node.name;
      if (name.type === "JSXIdentifier") {
        if (name.name.startsWith("on") && name.name.length > 2 && name.name[2] === name.name[2].toUpperCase()) {
          hasEventHandlers = true;
        }
      }
    },
  });

  const hasHooks = hooks.length > 0;
  const hasInteractiveHooks = hooks.some((h) => INTERACTIVE_HOOKS.includes(h));
  const onlyStaticDeps = dependencies.every(
    (d) => d.startsWith(".") || d.startsWith("@/") || STATIC_SAFE_PREFIXES.some((p) => d.startsWith(p)),
  );

  // Déterminer le mode suggéré et la confiance
  let suggestedMode: ComponentMode;
  let suggestedDirective: HydrationDirective | undefined;
  let confidence: "high" | "medium" | "low";

  if (usesBrowserApi) {
    // Accès direct aux API navigateur → client:only (ne peut pas être SSR)
    suggestedMode = "island";
    suggestedDirective = "client:only";
    confidence = "high";
  } else if (usesClientOnlyDep || usesContext) {
    // Dépendance forcément côté client (react-query, auth, etc.)
    suggestedMode = "island";
    suggestedDirective = "client:load";
    confidence = "high";
  } else if (hasInteractiveHooks) {
    suggestedMode = "island";
    suggestedDirective = "client:load";
    confidence = "high";
  } else if (hasEventHandlers && hasHooks) {
    suggestedMode = "island";
    suggestedDirective = "client:visible";
    confidence = "medium";
  } else if (hasEventHandlers) {
    suggestedMode = "island";
    suggestedDirective = "client:visible";
    confidence = "medium";
  } else if (hasHooks) {
    suggestedMode = "island";
    suggestedDirective = "client:idle";
    confidence = "medium";
  } else if (onlyStaticDeps && !hasHooks && !hasEventHandlers) {
    // Composant purement visuel (shadcn/ui wrapper, layout, etc.)
    suggestedMode = "static";
    confidence = "high";
  } else {
    suggestedMode = "static";
    confidence = "medium";
  }

  // Réduire la confiance si le composant utilise le routeur
  if (usesRouter) {
    confidence = confidence === "high" ? "medium" : "low";
  }

  return {
    filePath,
    hasHooks,
    hooks,
    hasEventHandlers,
    usesContext,
    usesRouter,
    dependencies,
    suggestedMode,
    suggestedDirective,
    confidence,
  };
}
