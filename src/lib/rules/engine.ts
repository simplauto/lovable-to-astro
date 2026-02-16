import { db } from "../db";
import { rules } from "../db/schema";
import { eq } from "drizzle-orm";
import type { ComponentAnalysis, ConversionRule } from "../../types";

/**
 * Cherche une règle existante pour un composant.
 */
export async function findRule(componentPath: string): Promise<ConversionRule | null> {
  const [rule] = await db
    .select()
    .from(rules)
    .where(eq(rules.componentPath, componentPath));

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
