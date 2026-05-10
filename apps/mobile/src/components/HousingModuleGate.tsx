import type { ReactNode } from "react";
import { ModuleFeatureGate } from "./ModuleFeatureGate";

export function HousingModuleGate({ children }: { children: ReactNode }) {
  return <ModuleFeatureGate feature="housing">{children}</ModuleFeatureGate>;
}
