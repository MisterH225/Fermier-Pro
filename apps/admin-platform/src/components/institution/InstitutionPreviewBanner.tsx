"use client";

import { useTranslations } from "next-intl";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstitutionPreview } from "@/lib/institution-preview-context";

export function InstitutionPreviewBanner() {
  const t = useTranslations("institutionPreview");
  const {
    isPreviewActive,
    viewAsInstitutionLabel,
    clearInstitutionPreview
  } = useInstitutionPreview();

  if (!isPreviewActive) {
    return null;
  }

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-amber-300/60 bg-amber-50/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-950">
          <Eye className="size-4 shrink-0" aria-hidden />
          {t("banner", {
            label: viewAsInstitutionLabel ?? t("unknownInstitution")
          })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-amber-300 bg-white/80"
          onClick={clearInstitutionPreview}
        >
          <X className="size-3.5 mr-1.5" aria-hidden />
          {t("exitPreview")}
        </Button>
      </div>
    </div>
  );
}
