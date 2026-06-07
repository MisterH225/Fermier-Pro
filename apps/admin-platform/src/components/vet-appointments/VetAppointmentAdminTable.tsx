"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AdminVetAppointmentRow } from "@/lib/api";
import { adminRefundVetAppointment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type Props = {
  rows: AdminVetAppointmentRow[];
  token: string;
  onRefunded: () => void;
};

function money(v: number | null | undefined, currency: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString("fr-FR")} ${currency}`;
}

const REFUNDABLE = new Set([
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_IN_PROGRESS",
  "AWAITING_PAYMENT"
]);

export function VetAppointmentAdminTable({ rows, token, onRefunded }: Props) {
  const t = useTranslations("vetAppointments");
  const [refundingId, setRefundingId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t("list.empty")}
        </CardContent>
      </Card>
    );
  }

  const handleRefund = async (id: string) => {
    if (!confirm(t("list.refundConfirm"))) return;
    setRefundingId(id);
    try {
      await adminRefundVetAppointment(token, id);
      onRefunded();
    } catch {
      alert(t("list.refundError"));
    } finally {
      setRefundingId(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("list.colFarm")}</TableHead>
              <TableHead>{t("list.colVet")}</TableHead>
              <TableHead>{t("list.colProducer")}</TableHead>
              <TableHead>{t("list.colStatus")}</TableHead>
              <TableHead className="text-right">{t("list.colAmount")}</TableHead>
              <TableHead>{t("list.colWhen")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium max-w-[140px] truncate">
                  {row.farmName ?? "—"}
                </TableCell>
                <TableCell className="text-sm">{row.vetName ?? "—"}</TableCell>
                <TableCell className="text-sm">{row.producerName ?? "—"}</TableCell>
                <TableCell>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`status.${row.status}`, { defaultValue: row.status })}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm">
                  {money(row.servicePrice ?? row.blockedAmount, row.currency)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.confirmedAt
                    ? new Date(row.confirmedAt).toLocaleString("fr-FR")
                    : new Date(row.requestedAt).toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="text-right">
                  {REFUNDABLE.has(row.status) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={refundingId === row.id}
                      onClick={() => void handleRefund(row.id)}
                    >
                      {refundingId === row.id ? "…" : t("list.refund")}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
