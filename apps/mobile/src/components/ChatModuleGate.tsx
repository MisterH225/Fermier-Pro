import type { ReactNode } from "react";
import { ModuleFeatureGate } from "./ModuleFeatureGate";

/** Alias pour `ModuleFeatureGate` avec `feature="chat"`. */
export function ChatModuleGate({ children }: { children: ReactNode }) {
  return <ModuleFeatureGate feature="chat">{children}</ModuleFeatureGate>;
}
