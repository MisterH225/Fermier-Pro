import type { ReactNode } from "react";
import { ModuleFeatureGate } from "./ModuleFeatureGate";

export function FinanceModuleGate({ children }: { children: ReactNode }) {
  return <ModuleFeatureGate feature="finance">{children}</ModuleFeatureGate>;
}
