import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlatformFeatureFlagsService } from "../feature-flags/platform-feature-flags.service";
import {
  CLIENT_FEATURE_TO_PLATFORM,
  PLATFORM_MODULE_IDS,
  type PlatformModuleId
} from "../feature-flags/platform-modules.constants";
import type { PlatformModulePublicDto } from "../feature-flags/platform-feature-flags.service";

/**
 * Feature flags : variables d'environnement (MVP) + état plateforme en base.
 */
export type ClientFeatureKey =
  | "marketplace"
  | "chat"
  | "vetConsultations"
  | "tasks"
  | "finance"
  | "housing"
  | "feedStock"
  | "wallet";

export type ClientFeatureFlags = Record<ClientFeatureKey, boolean>;

const ENV_KEYS: Record<ClientFeatureKey, string> = {
  marketplace: "FEATURE_MARKETPLACE",
  chat: "FEATURE_CHAT",
  vetConsultations: "FEATURE_VET_CONSULTATIONS",
  tasks: "FEATURE_TASKS",
  finance: "FEATURE_FINANCE",
  housing: "FEATURE_HOUSING",
  feedStock: "FEATURE_FEED_STOCK",
  wallet: "FEATURE_WALLET"
};

const DEFAULTS: ClientFeatureFlags = {
  marketplace: true,
  chat: true,
  vetConsultations: true,
  tasks: true,
  finance: true,
  housing: true,
  feedStock: true,
  wallet: true
};

@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly config: ConfigService,
    private readonly platformFlags: PlatformFeatureFlagsService
  ) {}

  async getClientFeatureFlags(): Promise<ClientFeatureFlags> {
    const platformRows = await this.platformFlags.listPublicModules();
    const activeMap = new Map(platformRows.map((r) => [r.moduleId, r.isActive]));

    return {
      marketplace: this.combine("marketplace", activeMap),
      chat: this.combine("chat", activeMap),
      vetConsultations: this.combine("vetConsultations", activeMap),
      tasks: this.combine("tasks", activeMap),
      finance: this.combine("finance", activeMap),
      housing: this.combine("housing", activeMap),
      feedStock: this.combine("feedStock", activeMap),
      wallet: this.combine("wallet", activeMap)
    };
  }

  async getPlatformModules(): Promise<PlatformModulePublicDto[]> {
    return this.platformFlags.listPublicModules();
  }

  async isEnabled(key: ClientFeatureKey): Promise<boolean> {
    const flags = await this.getClientFeatureFlags();
    return flags[key];
  }

  async isPlatformModuleEnabled(moduleId: PlatformModuleId): Promise<boolean> {
    return this.platformFlags.isModuleActive(moduleId);
  }

  async resolveInactiveContext(
    key: ClientFeatureKey
  ): Promise<{ moduleId: PlatformModuleId; message: string | null }> {
    const moduleId = CLIENT_FEATURE_TO_PLATFORM[key];
    const message = await this.platformFlags.getInactiveMessage(moduleId, "fr");
    return { moduleId, message };
  }

  private combine(
    key: ClientFeatureKey,
    activeMap: Map<string, boolean>
  ): boolean {
    const envOn = this.readBool(ENV_KEYS[key], DEFAULTS[key]);
    if (!envOn) return false;
    const platformId = CLIENT_FEATURE_TO_PLATFORM[key];
    return activeMap.get(platformId) ?? true;
  }

  private readBool(envKey: string, defaultValue: boolean): boolean {
    const raw = this.config.get<string>(envKey);
    if (raw === undefined || raw === "") {
      return defaultValue;
    }
    const v = raw.trim().toLowerCase();
    if (["0", "false", "no", "off", "disabled"].includes(v)) {
      return false;
    }
    if (["1", "true", "yes", "on", "enabled"].includes(v)) {
      return true;
    }
    return defaultValue;
  }
}

export { PLATFORM_MODULE_IDS, type PlatformModuleId };
