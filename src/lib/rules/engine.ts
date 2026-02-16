import { db } from "../db";
import { rules } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { ComponentAnalysis, ConversionRule } from "../../types";

/**
 * Cherche une règle existante pour un composant.
 * Si projectId est fourni, cherche d'abord une règle scopée au projet,
 * puis une règle globale (sans projectId).
 */
export async function findRule(componentPath: string, projectId?: number): Promise<ConversionRule | null> {
  // Chercher une règle scopée au projet d'abord
  if (projectId) {
    const [rule] = await db
      .select()
      .from(rules)
      .where(and(eq(rules.componentPath, componentPath), eq(rules.projectId, projectId)));

    if (rule) {
      return {
        componentPath: rule.componentPath,
        mode: rule.mode,
        hydrationDirective: rule.hydrationDirective ?? undefined,
        notes: rule.notes ?? undefined,
      };
    }
  }

  // Fallback sur une règle globale
  const [rule] = await db
    .select()
    .from(rules)
    .where(and(eq(rules.componentPath, componentPath), isNull(rules.projectId)));

  if (!rule) return null;

  return {
    componentPath: rule.componentPath,
    mode: rule.mode,
    hydrationDirective: rule.hydrationDirective ?? undefined,
    notes: rule.notes ?? undefined,
  };
}

/**
 * Détermine si un composant doit générer une question
 * (pas de règle existante et confiance faible).
 */
export function needsQuestion(analysis: ComponentAnalysis): boolean {
  return analysis.confidence === "low";
}
