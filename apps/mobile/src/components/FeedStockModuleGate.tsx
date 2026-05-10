import type { ReactNode } from "react";
import { ModuleFeatureGate } from "./ModuleFeatureGate";

/** Alias pour `ModuleFeatureGate` avec `feature="feedStock"`. */
export function FeedStockModuleGate({
  children
}: {
  children: ReactNode;
}) {
  return (
    <ModuleFeatureGate feature="feedStock">{children}</ModuleFeatureGate>
  );
}
