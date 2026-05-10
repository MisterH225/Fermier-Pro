import { SetMetadata } from "@nestjs/common";
import type { ClientFeatureKey } from "./feature-flags.service";

export const FEATURE_FLAG_METADATA = "fermier:requireFeature";

/** À utiliser avec `FeatureEnabledGuard` sur le contrôleur ou la méthode. */
export const RequireFeature = (key: ClientFeatureKey) =>
  SetMetadata(FEATURE_FLAG_METADATA, key);
