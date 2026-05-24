"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, type VetProfileRow } from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { DiplomeViewer } from "@/components/vets/DiplomeViewer";
import { VetStatusBadge } from "@/components/vets/VetStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function VetDetailPage() {
  const t = useTranslations("vets");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { token, ready } = useAdminToken();
  const [vet, setVet] = useState<VetProfileRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<VetProfileRow>(`/admin/vet-profiles/${id}`, token).then(setVet);
  }, [token, id]);

  const statusLabel = (status: string) => {
    if (status === "pending" || status === "verified" || status === "rejected") {
      return t(`statusLabels.${status}`);
    }
    return status;
  };

  const act = async (action: "verify" | "reject") => {
    if (!token) return;
    setBusy(true);
    try {
      if (action === "verify") {
        await apiFetch(`/admin/vet-profiles/${id}/verify`, token, { method: "POST" });
      } else {
        await apiFetch(`/admin/vet-profiles/${id}/reject`, token, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() || "Dossier incomplet" })
        });
      }
      router.push("/veterinaires");
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !vet) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={vet.fullName} />
      <VetStatusBadge
        status={vet.verificationStatus}
        label={statusLabel(vet.verificationStatus)}
      />

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Email:</span> {vet.user.email ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Tél:</span> {vet.user.phone ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Spécialité:</span> {vet.primarySpecialty}
            </p>
            <p>
              <span className="text-muted-foreground">Localisation:</span> {vet.locationCity},{" "}
              {vet.locationCountry}
            </p>
            <p>
              <span className="text-muted-foreground">École:</span> {vet.schoolName} (
              {vet.schoolCountry}) — {vet.graduationYear}
            </p>
          </CardContent>
        </Card>

        {vet.diplomaPhotoUrl ? (
          <DiplomeViewer
            url={vet.diplomaPhotoUrl}
            title={t("diploma")}
            openLabel={t("diplomaOpen")}
          />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("diploma")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">—</p>
            </CardContent>
          </Card>
        )}
      </div>

      {vet.verificationStatus === "pending" ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">{t("rejectReason")}</Label>
              <Textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("rejectPlaceholder")}
                className="min-h-[80px]"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled={busy} onClick={() => act("verify")}>
                {t("approve")}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => act("reject")}>
                {t("reject")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
