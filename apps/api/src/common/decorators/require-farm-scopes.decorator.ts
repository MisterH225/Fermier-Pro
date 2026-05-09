import { SetMetadata } from "@nestjs/common";

export const FARM_SCOPES_KEY = "farmScopes";

/** Exige les scopes metier sur la ferme (`farmId` dans la route). Le proprietaire a tout (`*`). */
export const RequireFarmScopes = (...scopes: string[]) =>
  SetMetadata(FARM_SCOPES_KEY, scopes);
