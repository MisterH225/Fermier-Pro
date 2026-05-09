export type ProfileType = "producer" | "technician" | "veterinarian" | "buyer";

/** Mode de suivi a la ferme (aligne Prisma `FarmLivestockMode`). */
export type FarmLivestockMode = "individual" | "batch" | "hybrid";

export interface ActiveContext {
  userId: string;
  profile: ProfileType;
  farmId?: string;
  scopes: string[];
}
