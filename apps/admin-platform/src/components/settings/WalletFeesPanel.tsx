"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Percent } from "lucide-react";
import {
  fetchWalletFeeConfigs,
  patchWalletFeeConfig,
  type WalletFeeConfigDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "./SettingsSection";

const FEE_TYPES: WalletFeeConfigDto["transactionType"][] = [
  "deposit",
  "withdrawal",
  "transfer"
];

type Props = {
  canEdit?: boolean;
};

export function WalletFeesPanel({ canEdit = true }: Props) {
  const t = useTranslations("walletAdmin.fees");
  const { token } = useAdminToken();
  const [configs, setConfigs] = useState<WalletFeeConfigDto[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Partial<Record<string, boolean>>>({});

  useEffect(() => {
    if (!token) return;
    void fetchWalletFeeConfigs(token).then((rows) =>
      setConfigs(
        rows.map((r) => ({
          ...r,
          feePercentage: Number(r.feePercentage) * 100
        }))
      )
    );
  }, [token]);

  const updateLocal = (
    type: WalletFeeConfigDto["transactionType"],
    patch: Partial<WalletFeeConfigDto>
  ) => {
    setSaved((prev) => ({ ...prev, [type]: false }));
    setConfigs((prev) =>
      prev.map((c) => (c.transactionType === type ? { ...c, ...patch } : c))
    );
  };

  const save = async (type: WalletFeeConfigDto["transactionType"]) => {
    if (!token || !canEdit) return;
    const row = configs.find((c) => c.transactionType === type);
    if (!row) return;
    setSaving(type);
    setSaved((prev) => ({ ...prev, [type]: false }));
    try {
      const next = await patchWalletFeeConfig(token, type, {
        feePercentage: row.feePercentage / 100,
        feeFixed: row.feeFixed,
        minFee: row.minFee,
        maxFee: row.maxFee,
        isActive: row.isActive
      });
      setConfigs((prev) =>
        prev.map((c) =>
          c.transactionType === type
            ? { ...next, feePercentage: Number(next.feePercentage) * 100 }
            : c
        )
      );
      setSaved((prev) => ({ ...prev, [type]: true }));
    } finally {
      setSaving(null);
    }
  };

  if (!configs.length) {
    return null;
  }

  return (
    <SettingsSection
      id="wallet-fees"
      icon={Percent}
      title={t("title")}
      description={t("hint")}
      bare
    >
      <div className="space-y-4">
        {FEE_TYPES.map((type) => {
          const row = configs.find((c) => c.transactionType === type);
          if (!row) return null;
          return (
            <div
              key={type}
              className="space-y-4 rounded-xl border bg-card p-5 shadow-sm"
            >
              <p className="font-medium text-sm">{t(`types.${type}`)}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("percentage")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    step={0.1}
                    disabled={!canEdit}
                    value={row.feePercentage}
                    onChange={(e) =>
                      updateLocal(type, {
                        feePercentage: Number(e.target.value) || 0
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("fixed")}</Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={!canEdit}
                    value={row.feeFixed}
                    onChange={(e) =>
                      updateLocal(type, { feeFixed: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("minFee")}</Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={!canEdit}
                    value={row.minFee}
                    onChange={(e) =>
                      updateLocal(type, { minFee: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("maxFee")}</Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={!canEdit}
                    value={row.maxFee ?? ""}
                    onChange={(e) =>
                      updateLocal(type, {
                        maxFee: e.target.value ? Number(e.target.value) : null
                      })
                    }
                  />
                </div>
              </div>
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving === type}
                    onClick={() => void save(type)}
                  >
                    {t("save")}
                  </Button>
                  {saved[type] ? (
                    <Badge variant="success">{t("saved")}</Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
