import { useMemo } from "react";
import type { AuthMeResponse } from "../lib/api";

export type CguStatusView = {
  needsAcceptance: boolean;
  isUpdate: boolean;
  currentVersion: string;
  versionAccepted: string | null;
  acceptedAt: string | null;
};

export function resolveCguStatus(authMe: AuthMeResponse | null): CguStatusView {
  if (authMe?.cgu) {
    const { cgu } = authMe;
    return {
      needsAcceptance: cgu.needsAcceptance,
      isUpdate: cgu.isUpdate,
      currentVersion: cgu.currentVersion,
      versionAccepted: cgu.versionAccepted,
      acceptedAt: cgu.acceptedAt
    };
  }
  if (authMe?.user) {
    const versionAccepted = authMe.user.cguVersionAccepted;
    const acceptedAt = authMe.user.cguAcceptedAt;
    const currentVersion = "1.0";
    const needsAcceptance =
      !acceptedAt || !versionAccepted || versionAccepted !== currentVersion;
    const isUpdate = Boolean(
      acceptedAt && versionAccepted && versionAccepted !== currentVersion
    );
    return {
      needsAcceptance,
      isUpdate,
      currentVersion,
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
