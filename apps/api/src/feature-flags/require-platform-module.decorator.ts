import { SetMetadata } from "@nestjs/common";
import type { PlatformModuleId } from "./platform-modules.constants";

export const PLATFORM_MODULE_METADATA = "fermier:requirePlatformModule";

export const RequirePlatformModule = (moduleId: PlatformModuleId) =>
  SetMetadata(PLATFORM_MODULE_METADATA, moduleId);
