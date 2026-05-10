import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Feature flags lus depuis l'environnement (MVP).
 * Convention : FEATURE_<CLE>=true|false|1|0|yes|no (insensible à la casse).
 * Les clés absentes utilisent la valeur par défaut (souvent true pour ne pas couper l'existant).
 */
export type ClientFeatureKey =
  | "marketplace"
  | "chat"
  | "vetConsultations"
  | "tasks"
  | "finance"
  | "housing"
  | "feedStock";

export type ClientFeatureFlags = Record<ClientFeatureKey, boolean>;

const ENV_KEYS: Record<ClientFeatureKey, string> = {
  marketplace: "FEATURE_MARKETPLACE",
  chat: "FEATURE_CHAT",
  vetConsultations: "FEATURE_VET_CONSULTATIONS",
  tasks: "FEATURE_TASKS",
  finance: "FEATURE_FINANCE",
  housing: "FEATURE_HOUSING",
  feedStock: "FEATURE_FEED_STOCK"
};

const DEFAULTS: ClientFeatureFlags = {
  marketplace: true,
  chat: true,
  vetConsultations: true,
  tasks: true,
  finance: true,
  housing: true,
  feedStock: true
};

@Injectable()
export class FeatureFlagService {
  constructor(private readonly config: ConfigService) {}

  /** Snapshot pour le client mobile / web (menus, routes). */
  getClientFeatureFlags(): ClientFeatureFlags {
    return {
      marketplace: this.readBool(ENV_KEYS.marketplace, DEFAULTS.marketplace),
      chat: this.readBool(ENV_KEYS.chat, DEFAULTS.chat),
      vetConsultations: this.readBool(
        ENV_KEYS.vetConsultations,
        DEFAULTS.vetConsultations
      ),
      tasks: this.readBool(ENV_KEYS.tasks, DEFAULTS.tasks),
      finance: this.readBool(ENV_KEYS.finance, DEFAULTS.finance),
      housing: this.readBool(ENV_KEYS.housing, DEFAULTS.housing),
      feedStock: this.readBool(ENV_KEYS.feedStock, DEFAULTS.feedStock)
    };
  }

  /** Vérification serveur (guards, désactivation route). */
  isEnabled(key: ClientFeatureKey): boolean {
    return this.getClientFeatureFlags()[key];
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
