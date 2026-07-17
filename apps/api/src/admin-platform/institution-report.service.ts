import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger
} from "@nestjs/common";
import { assertNoNominativeFields } from "./institution-privacy.util";
import type { EffectiveConsoleContext } from "./admin-console-access.service";
import { RegionalStatsQueryDto } from "./dto/regional-stats-query.dto";
import {
  INSTITUTION_REPORTS_STORAGE_BUCKET,
  INSTITUTION_STAT_SECTION_LABELS,
  type InstitutionReportBuildInput,
  type InstitutionReportBuildResult,
  type InstitutionReportFormat,
  type InstitutionReportSectionData
} from "./institution-report.constants";
import type { InstitutionStatSection } from "./institution-stats-sections.constants";
import {
  hasStatSectionAccess,
  resolveStatSections
} from "./institution-stats-sections.constants";
import { InstitutionReportCsvService } from "./institution-report-csv.service";
import { InstitutionReportPdfService } from "./institution-report-pdf.service";
import { StatsQueryService } from "./stats-query.service";
import { SupabaseAdminService } from "../auth/supabase-admin.service";

export type BuildInstitutionReportParams = {
  context: EffectiveConsoleContext;
  sections: InstitutionStatSection[];
  from: string;
  to: string;
  regionCode?: string;
  format: InstitutionReportFormat;
  persistToStorage?: boolean;
};

@Injectable()
export class InstitutionReportService {
  private readonly log = new Logger(InstitutionReportService.name);

  constructor(
    private readonly statsQuery: StatsQueryService,
    private readonly pdf: InstitutionReportPdfService,
    private readonly csv: InstitutionReportCsvService,
    private readonly supabaseAdmin: SupabaseAdminService
  ) {}

  async buildReport(
    params: BuildInstitutionReportParams
  ): Promise<InstitutionReportBuildResult> {
    const sections = this.filterAllowedSections(params.context, params.sections);
    if (sections.length === 0) {
      throw new ForbiddenException("Aucune section autorisée pour ce rapport");
    }

    const query: RegionalStatsQueryDto = {
      from: params.from,
      to: params.to,
      regionCode: params.regionCode
    };

    const sectionData: InstitutionReportSectionData[] = [];
    for (const section of sections) {
      const payload = await this.statsQuery.querySection(section, query);
      assertNoNominativeFields(payload);
      sectionData.push({
        section,
        label: INSTITUTION_STAT_SECTION_LABELS[section],
        from: payload.from,
        to: payload.to,
        coverage: payload.coverage,
        departments: payload.departments
      });
    }

    const institutionLabel = params.context.profile.institutionLabel;
    const coverage = sectionData[0]?.coverage ?? {
      farmCount: 0,
      animalCount: 0,
      departmentsCovered: 0
    };

    const buildInput: InstitutionReportBuildInput = {
      institutionLabel,
      sections,
      from: sectionData[0]?.from ?? params.from,
      to: sectionData[0]?.to ?? params.to,
      regionCode: params.regionCode,
      format: params.format
    };

    if (params.format === "pdf") {
      const buffer = await this.pdf.buildPdf({
        institutionLabel,
        from: buildInput.from,
        to: buildInput.to,
        coverage,
        sections: sectionData
      });
      assertNoNominativeFields({ sections: sectionData });
      const filename = this.pdfFilename(buildInput);
      return this.finalizeResult(buffer, "application/pdf", filename, params);
    }

    if (params.format === "csv") {
      const buffer = await this.csv.buildZip(
        sectionData,
        buildInput.from,
        buildInput.to
      );
      assertNoNominativeFields({ sections: sectionData });
      const filename = this.csvFilename(buildInput);
      return this.finalizeResult(
        buffer,
        "application/zip",
        filename,
        params
      );
    }

    throw new BadRequestException("Format de rapport non supporté");
  }

  private filterAllowedSections(
    context: EffectiveConsoleContext,
    requested: InstitutionStatSection[]
  ): InstitutionStatSection[] {
    const unique = [...new Set(requested)].filter(
      (section) => section !== "movements"
    );
    if (unique.length === 0) {
      return [];
    }
    if (
      context.profile.role === "superadmin" &&
      !context.isInstitutionPreview
    ) {
      return unique;
    }
    const allowed = new Set(resolveStatSections(context.profile));
    return unique.filter(
      (section) =>
        allowed.has(section) && hasStatSectionAccess(context.profile, section)
    );
  }

  private async finalizeResult(
    buffer: Buffer,
    contentType: string,
    filename: string,
    params: BuildInstitutionReportParams
  ): Promise<InstitutionReportBuildResult> {
    const result: InstitutionReportBuildResult = {
      buffer,
      contentType,
      filename
    };

    if (!params.persistToStorage || !this.supabaseAdmin.isConfigured()) {
      return result;
    }

    const institutionId =
      params.context.profile.institutionAccessId ??
      params.context.profile.institutionLabel ??
      "superadmin";
    const storagePath = `${institutionId}/${Date.now()}-${filename}`;
    try {
      await this.supabaseAdmin.uploadStorageObject(
        INSTITUTION_REPORTS_STORAGE_BUCKET,
        storagePath,
        buffer,
        contentType
      );
      result.storagePath = storagePath;
      const signedUrl = await this.supabaseAdmin.createSignedStoragePathUrl(
        INSTITUTION_REPORTS_STORAGE_BUCKET,
        storagePath,
        3600
      );
      if (signedUrl) {
        result.downloadUrl = signedUrl;
      }
    } catch (e) {
      this.log.warn(
        `Upload rapport institution échoué: ${(e as Error).message}`
      );
    }
    return result;
  }

  private pdfFilename(input: InstitutionReportBuildInput): string {
    const slug = (input.institutionLabel ?? "fermier-pro")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .slice(0, 40);
    return `rapport-stats-${slug}-${input.from}_${input.to}.pdf`;
  }

  private csvFilename(input: InstitutionReportBuildInput): string {
    const slug = (input.institutionLabel ?? "fermier-pro")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .slice(0, 40);
    return `rapport-stats-${slug}-${input.from}_${input.to}.zip`;
  }
}
