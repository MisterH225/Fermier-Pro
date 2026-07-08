"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  createAdminMerchantCategory,
  deleteAdminMerchantCategory,
  patchAdminMerchantCategory,
  type AdminMerchantCategoryRow
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type Props = {
  rows: AdminMerchantCategoryRow[];
  token: string;
  onRefresh: () => void;
};

function slugPreviewFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function MerchantCategoriesPanel({ rows, token, onRefresh }: Props) {
  const t = useTranslations("marketplace");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createAdminMerchantCategory(token, {
        name: name.trim(),
        slug: slug.trim() || undefined
      });
      setName("");
      setSlug("");
      setSlugTouched(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("merchantCategories.createError"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: AdminMerchantCategoryRow) => {
    await patchAdminMerchantCategory(token, row.id, {
      isActive: !row.isActive
    });
    onRefresh();
  };

  const onDelete = async (id: string) => {
    await deleteAdminMerchantCategory(token, id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("merchantCategories.createTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="merchant-cat-name">{t("merchantCategories.name")}</Label>
              <Input
                id="merchant-cat-name"
                value={name}
                onChange={(e) => {
                  const next = e.target.value;
                  setName(next);
                  if (!slugTouched) {
                    setSlug(slugPreviewFromName(next));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="merchant-cat-slug">{t("merchantCategories.slug")}</Label>
              <Input
                id="merchant-cat-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder={t("merchantCategories.slugHint")}
              />
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <Button disabled={busy || !name.trim()} onClick={() => void onCreate()}>
            {t("merchantCategories.create")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("merchantCategories.colName")}</TableHead>
                <TableHead>{t("merchantCategories.colSlug")}</TableHead>
                <TableHead>{t("merchantCategories.colOrder")}</TableHead>
                <TableHead>{t("merchantCategories.colActive")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t("merchantCategories.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="font-mono text-xs">{row.slug}</TableCell>
                    <TableCell>{row.sortOrder}</TableCell>
                    <TableCell>{row.isActive ? t("merchantCategories.yes") : t("merchantCategories.no")}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleActive(row)}
                      >
                        {row.isActive
                          ? t("merchantCategories.deactivate")
                          : t("merchantCategories.activate")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void onDelete(row.id)}
                      >
                        {t("merchantCategories.delete")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
