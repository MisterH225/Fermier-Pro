"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchAuditLogs, type AuditLogItem } from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Card } from "@/components/ui/card";

export default function AuditLogsPage() {
  const t = useTranslations("auditLogs");
  const { token, ready } = useAdminToken();
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchAuditLogs(token, { take: 100 })
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [token]);

  if (!ready) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-brand">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>
      <Card className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">{t("columns.date")}</th>
                <th className="px-4 py-3">{t("columns.admin")}</th>
                <th className="px-4 py-3">{t("columns.target")}</th>
                <th className="px-4 py-3">{t("columns.action")}</th>
                <th className="px-4 py-3">{t("columns.profile")}</th>
                <th className="px-4 py-3">{t("columns.reason")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="h-24 text-center text-muted-foreground">
                    …
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-24 text-center text-muted-foreground">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {row.admin.fullName ?? row.admin.email ?? row.admin.id}
                    </td>
                    <td className="px-4 py-3">
                      {row.target.fullName ?? row.target.email ?? row.target.id}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.action}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.targetProfileType}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate">{row.reason ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
