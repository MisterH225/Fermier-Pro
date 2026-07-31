"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createAdminFeedIngredient,
  deactivateAdminFeedIngredient,
  fetchAdminFeedIngredients,
  patchAdminFeedIngredient,
  type AdminFeedIngredientDto,
  type FeedIngredientCategory,
  type FeedIngredientWriteBody
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSection } from "@/components/layout/AdminSection";
import { Wheat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

const CATEGORIES: FeedIngredientCategory[] = [
  "cereal",
  "plant_protein",
  "animal_protein",
  "byproduct",
  "mineral",
  "additive"
];

const EMPTY_FORM: FeedIngredientWriteBody = {
  canonicalName: "",
  aliases: [],
  category: "cereal",
  crudeProteinPct: 0,
  metabolizableEnergyKcal: 0,
  lysinePct: 0,
  methioninePct: 0,
  calciumPct: 0,
  phosphorusPct: 0,
  crudeFiberPct: 0,
  fatPct: 0,
  dryMatterPct: 90,
  notes: ""
};

export function FeedIngredientsPanel() {
  const t = useTranslations("feedIngredients");
  const { token, ready } = useAdminToken();
  const [rows, setRows] = useState<AdminFeedIngredientDto[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FeedIngredientWriteBody>(EMPTY_FORM);
  const [aliasesText, setAliasesText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchAdminFeedIngredients(token, {
        q: q.trim() || undefined,
        includeInactive: true
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [token, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setAliasesText("");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (row: AdminFeedIngredientDto) => {
    setEditingId(row.id);
    setForm({
      canonicalName: row.canonicalName,
      aliases: row.aliases,
      category: row.category,
      crudeProteinPct: row.crudeProteinPct,
      metabolizableEnergyKcal: row.metabolizableEnergyKcal,
      lysinePct: row.lysinePct,
      methioninePct: row.methioninePct,
      calciumPct: row.calciumPct,
      phosphorusPct: row.phosphorusPct,
      crudeFiberPct: row.crudeFiberPct,
      fatPct: row.fatPct,
      dryMatterPct: row.dryMatterPct,
      notes: row.notes ?? ""
    });
    setAliasesText(row.aliases.join(", "));
    setError(null);
  };

  const numField = (
    key: keyof FeedIngredientWriteBody,
    label: string
  ) => (
    <div className="space-y-1" key={key}>
      <Label htmlFor={`fi-${key}`}>{label}</Label>
      <Input
        id={`fi-${key}`}
        type="number"
        step="any"
        value={Number(form[key] ?? 0)}
        onChange={(e) =>
          setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
        }
      />
    </div>
  );

  const onSubmit = async () => {
    if (!token || !form.canonicalName.trim()) return;
    setBusy(true);
    setError(null);
    const body: FeedIngredientWriteBody = {
      ...form,
      canonicalName: form.canonicalName.trim(),
      aliases: aliasesText
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      notes: form.notes?.trim() || undefined
    };
    try {
      if (editingId) {
        await patchAdminFeedIngredient(token, editingId, body);
      } else {
        await createAdminFeedIngredient(token, body);
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (row: AdminFeedIngredientDto) => {
    if (!token) return;
    if (row.isActive) {
      await deactivateAdminFeedIngredient(token, row.id);
    } else {
      await patchAdminFeedIngredient(token, row.id, { isActive: true });
    }
    await load();
  };

  if (!ready || loading) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <AdminPageShell>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <AdminSection icon={Wheat} title={t("formTitle")} bare>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {editingId ? t("editTitle") : t("createTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="fi-name">{t("canonicalName")}</Label>
                <Input
                  id="fi-name"
                  value={form.canonicalName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, canonicalName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fi-cat">{t("category")}</Label>
                <select
                  id="fi-cat"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      category: e.target.value as FeedIngredientCategory
                    }))
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fi-aliases">{t("aliases")}</Label>
              <Input
                id="fi-aliases"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
                placeholder={t("aliasesHint")}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {numField("crudeProteinPct", t("fields.crudeProteinPct"))}
              {numField(
                "metabolizableEnergyKcal",
                t("fields.metabolizableEnergyKcal")
              )}
              {numField("lysinePct", t("fields.lysinePct"))}
              {numField("methioninePct", t("fields.methioninePct"))}
              {numField("calciumPct", t("fields.calciumPct"))}
              {numField("phosphorusPct", t("fields.phosphorusPct"))}
              {numField("crudeFiberPct", t("fields.crudeFiberPct"))}
              {numField("fatPct", t("fields.fatPct"))}
              {numField("dryMatterPct", t("fields.dryMatterPct"))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="fi-notes">{t("notes")}</Label>
              <Textarea
                id="fi-notes"
                value={form.notes ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={busy || !form.canonicalName.trim()}
                onClick={() => void onSubmit()}
              >
                {editingId ? t("save") : t("create")}
              </Button>
              {editingId ? (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  {t("cancel")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </AdminSection>

      <AdminSection icon={Wheat} title={t("listTitle")} bare>
        <div className="mb-3 flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
          <Button type="button" variant="outline" onClick={() => void load()}>
            {t("search")}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("canonicalName")}</TableHead>
              <TableHead>{t("category")}</TableHead>
              <TableHead>PB %</TableHead>
              <TableHead>EM</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.canonicalName}</div>
                  {row.aliases.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {row.aliases.join(", ")}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{t(`categories.${row.category}`)}</TableCell>
                <TableCell>{row.crudeProteinPct}</TableCell>
                <TableCell>{row.metabolizableEnergyKcal}</TableCell>
                <TableCell>
                  <Badge variant={row.isActive ? "outline" : "destructive"}>
                    {row.isActive ? t("active") : t("inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(row)}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={row.isActive ? "destructive" : "outline"}
                    onClick={() => void onToggle(row)}
                  >
                    {row.isActive ? t("deactivate") : t("reactivate")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminSection>
    </AdminPageShell>
  );
}
