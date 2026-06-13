"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchAdminVetAppointmentRevenue,
  fetchAdminVetAppointments,
  type AdminVetAppointmentRevenueDto,
  type AdminVetAppointmentRow
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterPills } from "@/components/layout/FilterPills";
import { VetAppointmentAdminTable } from "@/components/vet-appointments/VetAppointmentAdminTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAIN_TABS = ["list", "revenue"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const STATUS_FILTERS = [
  "all",
  "APPOINTMENT_REQUESTED",
  "AWAITING_PAYMENT",
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_COMPLETED",
  "APPOINTMENT_RATED",
  "APPOINTMENT_REFUSED",
  "PAYMENT_EXPIRED",
  "CANCELLED_BY_PRODUCER",
  "CANCELLED_BY_VET"
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const PERIODS = ["7d", "30d", "90d", "all"] as const;

export default function VetAppointmentsAdminPage() {
  const t = useTranslations("vetAppointments");
  const { token, ready } = useAdminToken();
  const [mainTab, setMainTab] = useState<MainTab>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("30d");
  const [rows, setRows] = useState<AdminVetAppointmentRow[]>([]);
  const [revenue, setRevenue] = useState<AdminVetAppointmentRevenueDto | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    if (!token) return;
    const status = statusFilter === "all" ? undefined : statusFilter;
    const data = await fetchAdminVetAppointments(token, status);
    setRows(data ?? []);
  }, [token, statusFilter]);

  const loadRevenue = useCallback(async () => {
    if (!token) return;
    const data = await fetchAdminVetAppointmentRevenue(
      token,
      period === "all" ? undefined : period
    );
    setRevenue(data);
  }, [token, period]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const run = async () => {
      if (mainTab === "list") {
        await loadList();
      } else {
        await loadRevenue();
      }
    };
    void run().finally(() => setLoading(false));
  }, [token, mainTab, loadList, loadRevenue]);

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <FilterPills
        items={[...MAIN_TABS]}
        value={mainTab}
        onChange={setMainTab}
        label={(id) => t(`tabs.${id}`)}
      />

      {mainTab === "list" ? (
        <>
          <FilterPills
            items={[...STATUS_FILTERS]}
            value={statusFilter}
            onChange={setStatusFilter}
            label={(id) =>
              id === "all" ? t("list.allStatuses") : t(`status.${id}`, { defaultValue: id })
            }
          />
          {loading ? (
            <p className="text-muted-foreground">…</p>
          ) : (
            <VetAppointmentAdminTable
              rows={rows}
              token={token!}
              onRefunded={() => void loadList()}
            />
          )}
        </>
      ) : (
        <>
          <FilterPills
            items={[...PERIODS]}
            value={period}
            onChange={setPeriod}
            label={(id) => t(`revenue.period.${id}`)}
          />
          {loading || !revenue ? (
            <p className="text-muted-foreground">…</p>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("revenue.totalCommission")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {Math.round(revenue.totalCommission).toLocaleString("fr-FR")} XOF
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("revenue.totalGross")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {Math.round(revenue.totalGross).toLocaleString("fr-FR")} XOF
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("revenue.appointmentCount")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {revenue.appointmentCount}
                  </CardContent>
                </Card>
              </div>

              {revenue.lowRatedVets.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("revenue.lowRated")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {revenue.lowRatedVets.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                      >
                        <span className="font-medium">{v.fullName}</span>
                        <span className="text-muted-foreground">
                          ★ {v.ratingAvg?.toFixed(1)} ({v.ratingCount} avis) ·{" "}
                          {v.completedAppointments} prestations
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
