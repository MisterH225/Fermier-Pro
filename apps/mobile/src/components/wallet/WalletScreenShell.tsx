import type { ReactNode } from "react";
import { useMemo } from "react";
import { BuyerMobileShell } from "../layout/BuyerMobileShell";
import { MobileAppShell } from "../layout/MobileAppShell";
import { TechMobileShell } from "../layout/TechMobileShell";
import { VetMobileShell } from "../layout/VetMobileShell";
import { useSession } from "../../context/SessionContext";

type Props = {
  children: ReactNode;
};

export function WalletScreenShell({ children }: Props) {
  const { authMe, activeProfileId } = useSession();
  const profileType = useMemo(
    () => authMe?.profiles.find((p) => p.id === activeProfileId)?.type,
    [authMe?.profiles, activeProfileId]
  );

  const shellProps = { omitBottomTabBar: true, hideTopBar: true, children };
  switch (profileType) {
    case "buyer":
      return <BuyerMobileShell {...shellProps} />;
    case "veterinarian":
      return <VetMobileShell {...shellProps} />;
    case "technician":
      return <TechMobileShell {...shellProps} />;
    default:
      return <MobileAppShell {...shellProps} />;
  }
}
