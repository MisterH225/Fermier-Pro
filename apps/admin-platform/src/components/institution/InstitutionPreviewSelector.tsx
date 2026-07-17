"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchInstitutionConsoleUsers } from "@/lib/api";
import { useAdminAccess } from "@/lib/admin-access-context";
import { useAdminToken } from "@/lib/useAdminToken";
import { useInstitutionPreview } from "@/lib/institution-preview-context";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/lib/ui-styles";

export function InstitutionPreviewSelector() {
  const t = useTranslations("institutionPreview");
  const { profile } = useAdminAccess();
  const { token, ready } = useAdminToken();
  const {
    viewAsInstitutionId,
    setInstitutionPreview,
    clearInstitutionPreview
  } = useInstitutionPreview();
  const [institutions, setInstitutions] = useState<
    Array<{ id: string; label: string }>
  >([]);

  useEffect(() => {
    if (!ready || !token || profile?.role !== "superadmin") {
      return;
    }
    void fetchInstitutionConsoleUsers(token)
      .then((rows) =>
        setInstitutions(
          rows
            .filter((row) => row.isActive)
            .map((row) => ({
              id: row.id,
              label:
                row.institutionLabel?.trim() ||
                row.email ||
                row.fullName ||
                row.id
            }))
        )
      )
      .catch(() => setInstitutions([]));
  }, [ready, token, profile?.role]);

  const options = useMemo(
    () => [{ id: "", label: t("noPreview") }, ...institutions],
    [institutions, t]
  );

  if (profile?.role !== "superadmin") {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[220px]">
      <Label htmlFor="institution-preview-select" className="text-xs font-semibold">
        {t("selectorLabel")}
      </Label>
      <select
        id="institution-preview-select"
        className={selectClass}
        value={viewAsInstitutionId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) {
            clearInstitutionPreview();
            return;
          }
          const match = institutions.find((row) => row.id === id);
          setInstitutionPreview(id, match?.label ?? null);
        }}
      >
        {options.map((opt) => (
          <option key={opt.id || "none"} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
