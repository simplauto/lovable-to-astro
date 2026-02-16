export type ConversionStatus =
  | "pending"
  | "analyzing"
  | "converting"
  | "pushing"
  | "deploying"
  | "done"
  | "error"
  | "waiting_answers";

export type ComponentMode = "static" | "static-data" | "ssr" | "island";

export type HydrationDirective =
  | "client:load"
  | "client:visible"
  | "client:idle"
  | "client:only";

export interface ConversionRule {
  componentPath: string;
  mode: ComponentMode;
  hydrationDirective?: HydrationDirective;
  notes?: string;
}

export interface ComponentAnalysis {
  filePath: string;
  hasHooks: boolean;
  hooks: string[];
  hasEventHandlers: boolean;
  usesContext: boolean;
  usesRouter: boolean;
  dependencies: string[];
  suggestedMode: ComponentMode;
  suggestedDirective?: HydrationDirective;
  confidence: "high" | "medium" | "low";
}
