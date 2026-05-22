import { Injectable, Logger } from "@nestjs/common";
import {
  AI_MODULE_KEYS,
  type AiInsightDto,
  type AiInsightPriority,
  type AiModuleKey
} from "./ai.types";

@Injectable()
export class AiResponseParserService {
  private readonly logger = new Logger(AiResponseParserService.name);

  parse(raw: string, expectedModule: AiModuleKey): AiInsightDto[] {
    const trimmed = raw.trim();
    const jsonSlice = this.extractJsonArray(trimmed);
    if (!jsonSlice) {
      this.logger.warn("Réponse Gemini sans tableau JSON détectable");
      return [];
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonSlice);
    } catch {
      this.logger.warn("JSON Gemini invalide");
      return [];
    }
    if (!Array.isArray(parsed)) {
      return [];
    }
    const maxItems = expectedModule === "global_dashboard" ? 1 : 3;
    const items: AiInsightDto[] = [];
    for (const row of parsed) {
      const item = this.normalizeRow(row, expectedModule);
      if (item) {
        items.push(item);
      }
      if (items.length >= maxItems) {
        break;
      }
    }
    return items;
  }

  private extractJsonArray(text: string): string | null {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) {
      return text.slice(start, end + 1);
    }
    return null;
  }

  private normalizeRow(
    row: unknown,
    expectedModule: AiModuleKey
  ): AiInsightDto | null {
    if (!row || typeof row !== "object") {
      return null;
    }
    const r = row as Record<string, unknown>;
    const title = String(r.title ?? r.titre ?? "").trim();
    const message = String(r.message ?? r.contenu ?? "").trim();
    if (!title || !message) {
      return null;
    }
    const typeRaw = String(r.type ?? expectedModule).trim() as AiModuleKey;
    const type = AI_MODULE_KEYS.includes(typeRaw) ? typeRaw : expectedModule;
    const priority = this.normalizePriority(r.priority ?? r.priorité);
    return {
      type,
      priority,
      title: title.slice(0, 80),
      message: message.slice(0, 400),
      action_label:
        r.action_label != null
          ? String(r.action_label).trim() || null
          : r.actionLabel != null
            ? String(r.actionLabel).trim() || null
            : null,
      action_route:
        r.action_route != null
          ? String(r.action_route).trim() || null
          : r.actionRoute != null
            ? String(r.actionRoute).trim() || null
            : null
    };
  }

  private normalizePriority(raw: unknown): AiInsightPriority {
    const p = String(raw ?? "info").toLowerCase();
    if (p === "critical" || p === "critique") {
      return "critical";
    }
    if (p === "warning" || p === "avertissement") {
      return "warning";
    }
    return "info";
  }
}
