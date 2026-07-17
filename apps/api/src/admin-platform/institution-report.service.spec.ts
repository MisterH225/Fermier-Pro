import { InstitutionReportService } from "./institution-report.service";
import type { EffectiveConsoleContext } from "./admin-console-access.service";

describe("InstitutionReportService", () => {
  const statsQuery = {
    querySection: jest.fn()
  };
  const pdf = { buildPdf: jest.fn() };
  const csv = { buildZip: jest.fn() };
  const supabaseAdmin = {
    isConfigured: jest.fn().mockReturnValue(false),
    uploadStorageObject: jest.fn(),
    createSignedStoragePathUrl: jest.fn()
  };

  let service: InstitutionReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InstitutionReportService(
      statsQuery as never,
      pdf as never,
      csv as never,
      supabaseAdmin as never
    );
  });

  const institutionContext: EffectiveConsoleContext = {
    isInstitutionPreview: false,
    profile: {
      role: "institution",
      permissions: { stats: "read" },
      statSectionPermissions: { mortality: true },
      institutionLabel: "Ministère test",
      institutionAccessId: "inst-1"
    }
  };

  const superadminContext: EffectiveConsoleContext = {
    isInstitutionPreview: false,
    profile: {
      role: "superadmin",
      permissions: "all",
      statSectionPermissions: "all",
      institutionLabel: null,
      institutionAccessId: null
    }
  };

  it("limite aux sections autorisées pour une institution", async () => {
    statsQuery.querySection.mockResolvedValue({
      from: "2026-06-01",
      to: "2026-06-30",
      coverage: { farmCount: 5, animalCount: 40, departmentsCovered: 1 },
      departments: [{ departmentCode: "CI-AB", farmCount: 5, mortalityHeadcount: 1 }]
    });
    pdf.buildPdf.mockResolvedValue(Buffer.from("pdf"));

    await service.buildReport({
      context: institutionContext,
      sections: ["mortality", "herd"],
      from: "2026-06-01",
      to: "2026-06-30",
      format: "pdf"
    });

    expect(statsQuery.querySection).toHaveBeenCalledTimes(1);
    expect(statsQuery.querySection).toHaveBeenCalledWith(
      "mortality",
      expect.any(Object)
    );
  });

  it("superadmin peut générer toutes les sections demandées", async () => {
    statsQuery.querySection.mockResolvedValue({
      from: "2026-06-01",
      to: "2026-06-30",
      coverage: { farmCount: 10, animalCount: 100, departmentsCovered: 2 },
      departments: [
        { departmentCode: "CI-AB", farmCount: 6, mortalityHeadcount: 2 }
      ]
    });
    pdf.buildPdf.mockResolvedValue(Buffer.from("pdf"));

    const result = await service.buildReport({
      context: superadminContext,
      sections: ["mortality", "herd"],
      from: "2026-06-01",
      to: "2026-06-30",
      format: "pdf"
    });

    expect(statsQuery.querySection).toHaveBeenCalledTimes(2);
    expect(result.contentType).toBe("application/pdf");
    expect(result.buffer.toString()).toBe("pdf");
  });

  it("viewAs reproduit le périmètre institution", async () => {
    const previewContext: EffectiveConsoleContext = {
      isInstitutionPreview: true,
      profile: {
        role: "institution",
        permissions: { stats: "read" },
        statSectionPermissions: { mortality: true },
        institutionLabel: "Institution A",
        institutionAccessId: "inst-a"
      }
    };
    statsQuery.querySection.mockResolvedValue({
      from: "2026-06-01",
      to: "2026-06-30",
      coverage: { farmCount: 5, animalCount: 40, departmentsCovered: 1 },
      departments: [{ departmentCode: "CI-BK", farmCount: 5, masked: true }]
    });
    pdf.buildPdf.mockResolvedValue(Buffer.from("pdf-preview"));

    await service.buildReport({
      context: previewContext,
      sections: ["mortality", "herd"],
      from: "2026-06-01",
      to: "2026-06-30",
      format: "pdf"
    });

    expect(statsQuery.querySection).toHaveBeenCalledTimes(1);
    expect(statsQuery.querySection).toHaveBeenCalledWith(
      "mortality",
      expect.objectContaining({ from: "2026-06-01", to: "2026-06-30" })
    );
  });

  it("génère un zip CSV", async () => {
    statsQuery.querySection.mockResolvedValue({
      from: "2026-06-01",
      to: "2026-06-30",
      coverage: { farmCount: 8, animalCount: 80, departmentsCovered: 1 },
      departments: [{ departmentCode: "CI-AB", farmCount: 8 }]
    });
    csv.buildZip.mockResolvedValue(Buffer.from("zip"));

    const result = await service.buildReport({
      context: {
        ...institutionContext,
        profile: {
          ...institutionContext.profile,
          statSectionPermissions: { mortality: true, herd: true }
        }
      },
      sections: ["mortality"],
      from: "2026-06-01",
      to: "2026-06-30",
      format: "csv"
    });

    expect(result.contentType).toBe("application/zip");
    expect(csv.buildZip).toHaveBeenCalled();
  });
});
