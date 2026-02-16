import type { ComponentAnalysis, HydrationDirective } from "../../types";

/**
 * Détermine la directive d'hydratation optimale pour un composant.
 *
 * Heuristiques :
 * - client:load — interactivité immédiate (auth, navigation, formulaires actifs)
 * - client:visible — interactivité au scroll (cartes, sections interactives)
 * - client:idle — interactivité différée (analytics, tooltips)
 * - client:only — composant qui ne peut pas être rendu côté serveur (accès window/document)
 */
export function suggestHydrationDirective(analysis: ComponentAnalysis): HydrationDirective {
  // Composants utilisant le contexte ou le routeur → chargement immédiat
  if (analysis.usesContext || analysis.usesRouter) {
    return "client:load";
  }

  // Composants avec hooks interactifs (useState, useEffect) → chargement immédiat
  const hasInteractiveState = analysis.hooks.some((h) =>
    ["useState", "useReducer"].includes(h),
  );
  if (hasInteractiveState) {
    return "client:load";
  }

  // Composants avec event handlers uniquement → visible
  if (analysis.hasEventHandlers && !analysis.hasHooks) {
    return "client:visible";
  }

  // Composants avec useEffect mais sans état → idle
  if (analysis.hooks.includes("useEffect") && !hasInteractiveState) {
    return "client:idle";
  }

  // Par défaut → visible
  return "client:visible";
}
