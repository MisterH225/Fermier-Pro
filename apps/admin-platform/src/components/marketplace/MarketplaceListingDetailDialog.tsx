"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchAdminMarketplaceListingDetail,
  type AdminMarketplaceListingDetailDto
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type Props = {
  token: string;
  listingId: string | null;
  onClose: () => void;
};

function money(v: number | null | undefined, currency: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString("fr-FR")} ${currency}`;
}

function formatDate(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("fr-FR");
}

function personLabel(
  person: { fullName: string | null; email: string | null } | null | undefined
): string {
  if (!person) return "—";
  return person.fullName ?? person.email ?? "—";
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/40 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium break-words">{value}</p>
    </div>
  );
}

export function MarketplaceListingDetailDialog({ token, listingId, onClose }: Props) {
  const t = useTranslations("marketplace");
  const [detail, setDetail] = useState<AdminMarketplaceListingDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) {
      setDetail(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchAdminMarketplaceListingDetail(token, listingId)
      .then(setDetail)
      .catch((e) => {
        setDetail(null);
        setError(e instanceof Error ? e.message : t("listingDetail.error"));
      })
      .finally(() => setLoading(false));
  }, [token, listingId, t]);

  const photos =
    detail?.photoUrls?.length
      ? detail.photoUrls
      : detail?.fallbackPhotoUrl
        ? [detail.fallbackPhotoUrl]
        : detail?.animal?.photoUrl
          ? [detail.animal.photoUrl]
          : [];

  return (
    <Dialog open={Boolean(listingId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {detail?.title ?? t("listingDetail.title")}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        {detail ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {t(`listingStatus.${detail.status}`, { defaultValue: detail.status })}
              </Badge>
              {detail.category ? (
                <Badge variant="outline">{detail.category}</Badge>
              ) : null}
              {detail.archived ? (
                <Badge variant="destructive">{t("listingDetail.archived")}</Badge>
              ) : null}
            </div>

            {photos.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {photos.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt={detail.title}
                    className="h-28 w-28 shrink-0 rounded-2xl border border-white/60 bg-white/50 object-cover"
                  />
                ))}
              </div>
            ) : null}

            {detail.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {detail.description}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField
                label={t("listingDetail.seller")}
                value={personLabel(detail.seller)}
              />
              <DetailField
                label={t("listingDetail.farm")}
                value={detail.farm?.name ?? "—"}
              />
              <DetailField
                label={t("listingDetail.location")}
                value={detail.locationLabel ?? "—"}
              />
              <DetailField
                label={t("listingDetail.totalPrice")}
                value={money(detail.totalPrice, detail.currency)}
              />
              <DetailField
                label={t("listingDetail.pricePerKg")}
                value={money(detail.pricePerKg, detail.currency)}
              />
              <DetailField
                label={t("listingDetail.weight")}
                value={
                  detail.totalWeightKg != null
                    ? `${detail.totalWeightKg.toLocaleString("fr-FR")} kg`
                    : "—"
                }
              />
              <DetailField
                label={t("listingDetail.views")}
                value={detail.viewsCount.toLocaleString("fr-FR")}
              />
              <DetailField
                label={t("listingDetail.consultations")}
                value={detail.consultationsCount.toLocaleString("fr-FR")}
              />
              <DetailField
                label={t("listingDetail.publishedAt")}
                value={formatDate(detail.publishedAt)}
              />
              <DetailField
                label={t("listingDetail.expiresAt")}
                value={formatDate(detail.expiresAt)}
              />
              <DetailField
                label={t("listingDetail.updatedAt")}
                value={formatDate(detail.updatedAt)}
              />
              {detail.reservedForBuyer ? (
                <DetailField
                  label={t("listingDetail.reservedBuyer")}
                  value={personLabel(detail.reservedForBuyer)}
                />
              ) : null}
            </div>

            {detail.animal ? (
              <section className="space-y-2">
                <h3 className="text-sm font-bold">{t("listingDetail.animal")}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailField label={t("listingDetail.animalId")} value={detail.animal.publicId} />
                  <DetailField
                    label={t("listingDetail.animalTag")}
                    value={detail.animal.tagCode ?? "—"}
                  />
                  <DetailField label={t("listingDetail.animalSex")} value={detail.animal.sex ?? "—"} />
                  <DetailField
                    label={t("listingDetail.animalStatus")}
                    value={detail.animal.status}
                  />
                </div>
              </section>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-sm font-bold">
                {t("listingDetail.offers")} ({detail.offers.length})
              </h3>
              {detail.offers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("listingDetail.noOffers")}</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("listingDetail.colBuyer")}</TableHead>
                        <TableHead>{t("listingDetail.colOfferStatus")}</TableHead>
                        <TableHead className="text-right">{t("listingDetail.colPrice")}</TableHead>
                        <TableHead>{t("listingDetail.colDate")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.offers.map((offer) => (
                        <TableRow key={offer.id}>
                          <TableCell>{personLabel(offer.buyer)}</TableCell>
                          <TableCell>{offer.status}</TableCell>
                          <TableCell className="text-right">
                            {money(offer.offeredPrice, detail.currency)}
                          </TableCell>
                          <TableCell>{formatDate(offer.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold">
                {t("listingDetail.transactions")} ({detail.transactions.length})
              </h3>
              {detail.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("listingDetail.noTransactions")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("listingDetail.colBuyer")}</TableHead>
                        <TableHead>{t("transactions.colStatus")}</TableHead>
                        <TableHead className="text-right">{t("transactions.colAmount")}</TableHead>
                        <TableHead>{t("transactions.colUpdated")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>{personLabel(tx.buyer)}</TableCell>
                          <TableCell>
                            {t(`status.${tx.status}`, { defaultValue: tx.status })}
                          </TableCell>
                          <TableCell className="text-right">
                            {money(tx.blockedAmount, tx.currency)}
                          </TableCell>
                          <TableCell>{formatDate(tx.updatedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
