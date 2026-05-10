import type { ReactNode } from "react";
import { ModuleFeatureGate } from "./ModuleFeatureGate";

export function VetModuleGate({ children }: { children: ReactNode }) {
  return (
    <ModuleFeatureGate feature="vetConsultations">{children}</ModuleFeatureGate>
  );
}
