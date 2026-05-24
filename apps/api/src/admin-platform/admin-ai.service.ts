import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { VetVerificationStatus } from "@prisma/client";
import { AiGeminiService } from "../ai/ai-gemini.service";
import { AdminPlatformService } from "./admin-platform.service";

export type AdminEpidemicAnalysis = {
  summary: string;
  emergingDiseases: string[];
  riskZones: string[];
  trends: string[];
  recommendations: string[];
  generatedAt: string;
  unavailable?: boolean;
};

export type AdminAiAskResult = {
  answer: string;
  generatedAt: string;
  unavailable?: boolean;
};

export type AdminVetAssistResult = {
  readableDiploma: "yes" | "no" | "manual_check";
  infoConsistent: boolean;
  confidenceScore: number;
  recommendation: "approve" | "review" | "reject";
  notes: string;
  generatedAt: string;
  unavailable?: boolean;
  diplomaImageAnalyzed?: boolean;
};

@Injectable()
export class AdminAiService {
  private readonly logger = new Logger(AdminAiService.name);

  constructor(
    private readonly admin: AdminPlatformService,
    private readonly gemini: AiGeminiService
  ) {}

  async epidemicAnalysis(locale = "fr"): Promise<AdminEpidemicAnalysis> {
    const generatedAt = new Date().toISOString();
    if (!this.gemini.isConfigured()) {
      return {
        summary: "",
        emergingDiseases: [],
        riskZones: [],
        trends: [],
        recommendations: [],
        generatedAt,
        unavailable: true
      };
    }

    const [stats, healthMap, overview] = await Promise.all([
      this.admin.getStats("month"),
      this.admin.getHealthMap(30),
      this.admin.getOverview()
    ]);

    const lang = locale === "en" ? "English" : "French";
    const prompt = `You are a veterinary epidemiology analyst for a pig farm management platform.
Respond ONLY with valid JSON (no markdown). All text fields must be in ${lang}.
Use ONLY the anonymized aggregated data below — never invent individual farm identities.

Data:
${JSON.stringify({
  kpis: overview.kpis,
  stats,
  healthRegions: healthMap.regions.slice(0, 15),
  activeGeoPoints: healthMap.points.length
})}

JSON schema:
{
  "summary": "2-4 sentence situation overview",
  "emergingDiseases": ["string"],
  "riskZones": ["string"],
  "trends": ["string"],
  "recommendations": ["string — max 5 prioritized preventive actions"]
}`;

    const parsed = await this.parseJson<{
      summary?: string;
      emergingDiseases?: string[];
      riskZones?: string[];
      trends?: string[];
      recommendations?: string[];
    }>(prompt);

    if (!parsed) {
      return {
        summary: "",
        emergingDiseases: [],
        riskZones: [],
        trends: [],
        recommendations: [],
        generatedAt,
        unavailable: true
      };
    }

    return {
      summary: parsed.summary?.trim() ?? "",
      emergingDiseases: parsed.emergingDiseases ?? [],
      riskZones: parsed.riskZones ?? [],
      trends: parsed.trends ?? [],
      recommendations: parsed.recommendations ?? [],
      generatedAt
    };
  }

  async ask(question: string, locale = "fr"): Promise<AdminAiAskResult> {
    const generatedAt = new Date().toISOString();
    const q = question.trim();
    if (!q) {
      return { answer: "", generatedAt, unavailable: true };
    }
    if (!this.gemini.isConfigured()) {
      return { answer: "", generatedAt, unavailable: true };
    }

    const [stats, overview] = await Promise.all([
      this.admin.getStats("month"),
      this.admin.getOverview()
    ]);

    const lang = locale === "en" ? "English" : "French";
    const prompt = `You are a SuperAdmin decision assistant for a pig farm platform.
Answer in ${lang}. Use only aggregated anonymized context. If data is insufficient, say so clearly.
Respond ONLY with JSON: { "answer": "markdown-free plain text, max 800 words" }

Context:
${JSON.stringify({ kpis: overview.kpis, stats })}

Question:
${q}`;

    const parsed = await this.parseJson<{ answer?: string }>(prompt);
    if (!parsed?.answer?.trim()) {
      return { answer: "", generatedAt, unavailable: true };
    }
    return { answer: parsed.answer.trim(), generatedAt };
  }

  async vetAssist(vetId: string, locale = "fr"): Promise<AdminVetAssistResult> {
    const generatedAt = new Date().toISOString();
    const base = {
      readableDiploma: "manual_check" as const,
      infoConsistent: true,
      confidenceScore: 50,
      recommendation: "review" as const,
      notes: "",
      generatedAt,
      unavailable: true
    };

    const vet = await this.admin.getVetProfile(vetId);
    if (vet.verificationStatus !== VetVerificationStatus.pending) {
      throw new NotFoundException("Dossier non éligible à l'analyse IA");
    }

    if (!this.gemini.isConfigured()) {
      return base;
    }

    const lang = locale === "en" ? "English" : "French";
    let diplomaImageAnalyzed = false;
    let visionReadable: "yes" | "no" | "manual_check" | null = null;
    let visionNotes = "";

    if (vet.diplomaPhotoUrl?.trim()) {
      const visionRaw = await this.gemini.generateWithImageUrl(
        `Analyze this veterinary diploma document image. Respond ONLY with JSON:
{
  "readable": boolean,
  "appearsVeterinaryDiploma": boolean,
  "schoolVisible": boolean,
  "yearVisible": boolean,
  "notes": "brief note in ${lang}"
}`,
        vet.diplomaPhotoUrl.trim()
      );
      if (visionRaw) {
        diplomaImageAnalyzed = true;
        try {
          const vision = JSON.parse(visionRaw) as {
            readable?: boolean;
            appearsVeterinaryDiploma?: boolean;
            notes?: string;
          };
          visionNotes = vision.notes?.trim() ?? "";
          if (vision.readable === true && vision.appearsVeterinaryDiploma !== false) {
            visionReadable = "yes";
          } else if (vision.readable === false) {
            visionReadable = "no";
          } else {
            visionReadable = "manual_check";
          }
        } catch {
          visionReadable = "manual_check";
        }
      }
    }

    const prompt = `You assist a SuperAdmin reviewing a veterinarian registration.
${diplomaImageAnalyzed ? "A diploma image was analyzed by vision AI — factor visionNotes into your assessment." : "Diploma image was not analyzed."}
Respond ONLY with JSON in ${lang} for "notes", other fields as specified.

Profile:
${JSON.stringify({
  fullName: vet.fullName,
  schoolName: vet.schoolName,
  schoolCountry: vet.schoolCountry,
  graduationYear: vet.graduationYear,
  locationCity: vet.locationCity,
  locationCountry: vet.locationCountry,
  primarySpecialty: vet.primarySpecialty,
  hasDiplomaUrl: Boolean(vet.diplomaPhotoUrl),
  visionReadable,
  visionNotes
})}

JSON schema:
{
  "readableDiploma": "yes" | "no" | "manual_check",
  "infoConsistent": boolean,
  "confidenceScore": number (0-100),
  "recommendation": "approve" | "review" | "reject",
  "notes": "brief rationale"
}`;

    const parsed = await this.parseJson<{
      readableDiploma?: "yes" | "no" | "manual_check";
      infoConsistent?: boolean;
      confidenceScore?: number;
      recommendation?: "approve" | "review" | "reject";
      notes?: string;
    }>(prompt);

    if (!parsed) {
      return base;
    }

    const score = Math.min(100, Math.max(0, Number(parsed.confidenceScore) || 50));
    const rec = parsed.recommendation;
    const recommendation =
      rec === "approve" || rec === "reject" || rec === "review" ? rec : "review";

    return {
      readableDiploma: visionReadable ?? parsed.readableDiploma ?? "manual_check",
      infoConsistent: Boolean(parsed.infoConsistent),
      confidenceScore: score,
      recommendation,
      notes: [parsed.notes?.trim(), visionNotes].filter(Boolean).join(" — "),
      generatedAt,
      diplomaImageAnalyzed
    };
  }

  private async parseJson<T>(prompt: string): Promise<T | null> {
    const raw = await this.gemini.generateText(prompt);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        this.logger.warn("Réponse IA admin sans JSON");
        return null;
      }
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
  }
}
