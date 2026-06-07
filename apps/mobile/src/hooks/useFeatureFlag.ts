import { useMemo } from "react";
import type { PlatformModuleId, PlatformModuleDto } from "../lib/api";
import { useSession } from "../context/SessionContext";

export function useFeatureFlag(moduleId: PlatformModuleId) {
  const { platformModules } = useSession();

  return useMemo(() => {
    const row = platformModules.find((m) => m.moduleId === moduleId);
    const isActive = row?.isActive ?? moduleId === "core_producer";
    return {
      isActive,
      module: row,
      message: isActive ? null : row?.userMessageFr ?? row?.userMessageEn ?? null
    };
  }, [moduleId, platformModules]);
}

export function usePlatformModules(): PlatformModuleDto[] {
  const { platformModules } = useSession();
  return platformModules;
}
