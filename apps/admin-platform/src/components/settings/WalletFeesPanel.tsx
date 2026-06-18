"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchWalletFeeConfigs,
  patchWalletFeeConfig,
  type WalletFeeConfigDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FEE_TYPES: WalletFeeConfigDto["transactionType"][] = [
  "deposit",
  "withdrawal",
  "transfer"
];

export function WalletFeesPanel() {
  const t = useTranslations("walletAdmin.fees");
  const { token } = useAdminToken();
  const [configs, setConfigs] = useState<WalletFeeConfigDto[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

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
    setConfigs((prev) =>
      prev.map((c) => (c.transactionType === type ? { ...c, ...patch } : c))
    );
  };

  const save = async (type: WalletFeeConfigDto["transactionType"]) => {
    if (!token) return;
    const row = configs.find((c) => c.transactionType === type);
    if (!row) return;
    setSaving(type);
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
    } finally {
      setSaving(null);
    }
  };

  if (!configs.length) {
    return null;
  }

  return (
    <Card id="wallet-fees">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        {FEE_TYPES.map((type) => {
          const row = configs.find((c) => c.transactionType === type);
          if (!row) return null;
          return (
            <div key={type} className="space-y-3 rounded-xl border p-4">
              <p className="font-medium">{t(`types.${type}`)}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t("percentage")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    step={0.1}
                    value={row.feePercentage}
                    onChange={(e) =>
                      updateLocal(type, {
                        feePercentage: Number(e.target.value) || 0
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("fixed")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.feeFixed}
                    onChange={(e) =>
                      updateLocal(type, { feeFixed: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("minFee")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.minFee}
                    onChange={(e) =>
                      updateLocal(type, { minFee: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("maxFee")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.maxFee ?? ""}
                    onChange={(e) =>
                      updateLocal(type, {
                        maxFee: e.target.value ? Number(e.target.value) : null
                      })
                    }
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={saving === type}
                onClick={() => void save(type)}
              >
                {t("save")}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
