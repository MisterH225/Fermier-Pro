import type { ReactNode } from "react";
import { ModuleFeatureGate } from "./ModuleFeatureGate";

/** Alias pour `ModuleFeatureGate` avec `feature="tasks"`. */
export function TasksModuleGate({ children }: { children: ReactNode }) {
  return <ModuleFeatureGate feature="tasks">{children}</ModuleFeatureGate>;
}
