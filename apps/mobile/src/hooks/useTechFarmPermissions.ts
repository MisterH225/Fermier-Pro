import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSession } from "../context/SessionContext";
import { fetchTechnicianDashboard } from "../lib/api";
import {
  canTechViewFarmModule,
  canTechWriteFarmModule,
  type TechFarmModuleKey
} from "../lib/technicianPermissions";

export function useTechFarmPermissions(
  farmId: string,
  module: TechFarmModuleKey
) {
  const { accessToken, activeProfileId, authMe } = useSession();
  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isTech = profileType === "technician";

  const dashQ = useQuery({
    queryKey: ["techDashboard", activeProfileId, farmId, "permissions"],
    queryFn: () => fetchTechnicianDashboard(accessToken!, activeProfileId, farmId),
    enabled: Boolean(accessToken && isTech && farmId),
    staleTime: 60_000
  });

  const scopes = useMemo(() => {
    if (!isTech) {
      return undefined;
    }
    const farm = dashQ.data?.farms.find((f) => f.farmId === farmId);
    return farm?.scopes ?? dashQ.data?.farms[0]?.scopes;
  }, [isTech, dashQ.data, farmId]);

  const canView = !isTech || canTechViewFarmModule(scopes, module);
  const canWrite = !isTech || canTechWriteFarmModule(scopes, module);
  const readOnly = isTech && canView && !canWrite;

  return {
    isTech,
    loading: isTech && dashQ.isPending,
    scopes,
    canView,
    canWrite,
    readOnly
  };
}
