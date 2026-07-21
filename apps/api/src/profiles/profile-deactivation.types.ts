import type { ProfileType } from "@prisma/client";

/** Codes machine pour les blocages de désactivation. */
export const PROFILE_DEACTIVATION_BLOCK = {
  LAST_ACTIVE_PROFILE: "LAST_ACTIVE_PROFILE",
  PRODUCER_FARM_ACTIVE: "PRODUCER_FARM_ACTIVE",
  BUYER_OPEN_TRANSACTION: "BUYER_OPEN_TRANSACTION",
  VET_OPEN_APPOINTMENT: "VET_OPEN_APPOINTMENT",
  VET_PENDING_WITHDRAWAL: "VET_PENDING_WITHDRAWAL",
  MERCHANT_ACTIVE_SUBSCRIPTION: "MERCHANT_ACTIVE_SUBSCRIPTION",
  MERCHANT_OPEN_ORDER: "MERCHANT_OPEN_ORDER",
  TECHNICIAN_OPEN_TASK: "TECHNICIAN_OPEN_TASK",
  MODERATION_SANCTION: "MODERATION_SANCTION",
  ALREADY_DEACTIVATED: "ALREADY_DEACTIVATED",
  NOT_DEACTIVATED: "NOT_DEACTIVATED"
} as const;

export type ProfileDeactivationBlockCode =
  (typeof PROFILE_DEACTIVATION_BLOCK)[keyof typeof PROFILE_DEACTIVATION_BLOCK];

export type ProfileDeactivationBlock = {
  code: ProfileDeactivationBlockCode;
  /** Message lisible FR côté API (i18n client peut mapper le code). */
  message: string;
  /** Compteur optionnel (ex. nb de RDV). */
  count?: number;
  /** Lien / ressource à résoudre (id ou path relatif). */
  resolveHint?: string | null;
};

export type ProfileDeactivationEffect = {
  /** Ce qui sera masqué / arrêté. */
  willHide: string[];
  /** Ce qui est conservé (historique). */
  willKeep: string[];
};

export type ProfileDeactivationPreview = {
  profileId: string;
  profileType: ProfileType;
  canDeactivate: boolean;
  blocks: ProfileDeactivationBlock[];
  effects: ProfileDeactivationEffect;
};

export type ProfileDeactivateResult = {
  profileId: string;
  profileStatus: "deactivated";
  deactivatedAt: string;
  /** Profil actif suggéré après désactivation (si c'était le défaut). */
  suggestedActiveProfileId: string | null;
};
