import type { ReactNode } from "react";
import { ModuleFeatureGate } from "./ModuleFeatureGate";

/** Alias pour `ModuleFeatureGate` avec `feature="marketplace"`. */
export function MarketplaceModuleGate({
  children
}: {
  children: ReactNode;
}) {
  return (
    <ModuleFeatureGate feature="marketplace">{children}</ModuleFeatureGate>
  );
}
