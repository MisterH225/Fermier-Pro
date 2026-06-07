import { useMemo } from "react";
import type { AuthMeResponse } from "../lib/api";

export type CguStatusView = {
  needsAcceptance: boolean;
  isUpdate: boolean;
  currentVersion: string;
  versionAccepted: string | null;
  acceptedAt: string | null;
};

/** CGU : une seule acceptation par compte (première connexion ou nouveau compte après suppression). */
export function resolveCguStatus(authMe: AuthMeResponse | null): CguStatusView {
  if (authMe?.cgu) {
    const { cgu } = authMe;
    return {
      needsAcceptance: cgu.needsAcceptance,
      isUpdate: false,
      currentVersion: cgu.currentVersion,
      versionAccepted: cgu.versionAccepted,
      acceptedAt: cgu.acceptedAt
    };
  }
  if (authMe?.user) {
    const versionAccepted = authMe.user.cguVersionAccepted;
    const acceptedAt = authMe.user.cguAcceptedAt;
    return {
      needsAcceptance: acceptedAt == null,
      isUpdate: false,
      currentVersion: "1.0",
      versionAccepted,
      acceptedAt
    };
  }
  return {
    needsAcceptance: true,
    isUpdate: false,
    currentVersion: "1.0",
    versionAccepted: null,
    acceptedAt: null
  };
}

export function useCGUStatus(authMe: AuthMeResponse | null): CguStatusView {
  return useMemo(() => resolveCguStatus(authMe), [authMe]);
}
