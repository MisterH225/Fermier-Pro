"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createAdminFeedIngredient,
  deactivateAdminFeedIngredient,
  fetchAdminFeedIngredients,
  patchAdminFeedIngredient,
  reviewAdminFeedIngredient,
  type AdminFeedIngredientDto,
  type FeedIngredientCategory,
  type FeedIngredientWriteBody
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSection } from "@/components/layout/AdminSection";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
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
import { cn } from "@/lib/utils";

const CATEGORIES: FeedIngredientCategory[] = [
  "cereal",
  "plant_protein",
  "animal_protein",
  "byproduct",
  "mineral",
  "additive"
];

type NutritionKey =
  | "crudeProteinPct"
  | "metabolizableEnergyKcal"
  | "lysinePct"
  | "methioninePct"
  | "calciumPct"
  | "phosphorusPct"
  | "crudeFiberPct"
  | "fatPct"
  | "dryMatterPct";

const NUTRITION_KEYS: NutritionKey[] = [
  "crudeProteinPct",
  "metabolizableEnergyKcal",
  "lysinePct",
  "methioninePct",
  "calciumPct",
  "phosphorusPct",
  "crudeFiberPct",
  "fatPct",
  "dryMatterPct"
];

type NutritionDraft = Record<NutritionKey, number>;

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
  notes: "",
  imageUrl: "",
  iconKey: "cereal"
};

function nutritionFromRow(row: AdminFeedIngredientDto): NutritionDraft {
  return {
    crudeProteinPct: row.crudeProteinPct,
    metabolizableEnergyKcal: row.metabolizableEnergyKcal,
    lysinePct: row.lysinePct,
    methioninePct: row.methioninePct,
    calciumPct: row.calciumPct,
    phosphorusPct: row.phosphorusPct,
    crudeFiberPct: row.crudeFiberPct,
    fatPct: row.fatPct,
    dryMatterPct: row.dryMatterPct
  };
}

function validateNutrition(draft: NutritionDraft): string | null {
  for (const key of NUTRITION_KEYS) {
    const v = draft[key];
    if (!Number.isFinite(v)) {
      return "Valeurs nutritionnelles invalides";
    }
    if (key === "metabolizableEnergyKcal") {
      if (v < 0) return "L'énergie métabolisable doit être ≥ 0";
      continue;
    }
    if (v < 0 || v > 100) {
      return "Les pourcentages doivent être entre 0 et 100";
    }
  }
  return null;
}

function isDirty(row: AdminFeedIngredientDto, draft: NutritionDraft): boolean {
  return NUTRITION_KEYS.some((k) => draft[k] !== row[k]);
}

export function FeedIngredientsPanel() {
  const t = useTranslations("feedIngredients");
  const { token, ready } = useAdminToken();
  const [rows, setRows] = useState<AdminFeedIngredientDto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, NutritionDraft>>({});
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    FeedIngredientCategory | ""
  >("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<FeedIngredientWriteBody>(EMPTY_FORM);
  const [aliasesText, setAliasesText] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAdminFeedIngredients(token, {
        q: q.trim() || undefined,
        category: categoryFilter || undefined,
        includeInactive: true
      });
      setRows(data);
      setDrafts(Object.fromEntries(data.map((r) => [r.id, nutritionFromRow(r)])));
      setRowErrors({});
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t("loadError"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, q, categoryFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<FeedIngredientCategory, AdminFeedIngredientDto[]>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const row of rows) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, "fr"));
    }
    return CATEGORIES.map((category) => ({
      category,
      items: map.get(category) ?? []
    })).filter((g) => g.items.length > 0);
  }, [rows]);

  const setDraftValue = (id: string, key: NutritionKey, raw: string) => {
    const num = raw === "" ? Number.NaN : Number(raw);
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? nutritionFromRow(rows.find((r) => r.id === id)!)), [key]: num }
    }));
  };

  const saveRow = async (row: AdminFeedIngredientDto) => {
    if (!token) return;
    const draft = draftsRef.current[row.id] ?? nutritionFromRow(row);
    const validationError = validateNutrition(draft);
    if (validationError) {
      setRowErrors((e) => ({ ...e, [row.id]: validationError }));
      return;
    }
    if (!isDirty(row, draft)) return;
    setBusyId(row.id);
    setRowErrors((e) => {
      const next = { ...e };
      delete next[row.id];
      return next;
    });
    try {
      const updated = await patchAdminFeedIngredient(token, row.id, draft);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      setDrafts((prev) => ({ ...prev, [row.id]: nutritionFromRow(updated) }));
    } catch (e) {
      setRowErrors((err) => ({
        ...err,
        [row.id]: e instanceof Error ? e.message : t("saveError")
      }));
    } finally {
      setBusyId(null);
    }
  };

  const onToggle = async (row: AdminFeedIngredientDto) => {
    if (!token) return;
    setBusyId(row.id);
    try {
      const updated = row.isActive
        ? await deactivateAdminFeedIngredient(token, row.id)
        : await patchAdminFeedIngredient(token, row.id, { isActive: true });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } catch (e) {
      setRowErrors((err) => ({
        ...err,
        [row.id]: e instanceof Error ? e.message : t("saveError")
      }));
    } finally {
      setBusyId(null);
    }
  };

  const onMarkReviewed = async (row: AdminFeedIngredientDto) => {
    if (!token || row.reviewedAt) return;
    setBusyId(row.id);
    try {
      const updated = await reviewAdminFeedIngredient(token, row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } catch (e) {
      setRowErrors((err) => ({
        ...err,
        [row.id]: e instanceof Error ? e.message : t("saveError")
      }));
    } finally {
      setBusyId(null);
    }
  };

  const onCreate = async () => {
    if (!token || !form.canonicalName.trim()) return;
    const validationError = validateNutrition(form);
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    try {
      await createAdminFeedIngredient(token, {
        ...form,
        canonicalName: form.canonicalName.trim(),
        aliases: aliasesText
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        notes: form.notes?.trim() || undefined,
        imageUrl: form.imageUrl?.trim() || null,
        iconKey: form.iconKey?.trim() || form.category
      });
      setForm(EMPTY_FORM);
      setAliasesText("");
      setCreateOpen(false);
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setCreateBusy(false);
    }
  };

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <AdminPageShell wide>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <AdminSection icon={Package} title={t("listTitle")} bare>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="fi-search">{t("search")}</Label>
            <Input
              id="fi-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
            />
          </div>
          <div className="w-full sm:w-56 space-y-1">
            <Label htmlFor="fi-cat-filter">{t("category")}</Label>
            <select
              id="fi-cat-filter"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(
                  (e.target.value || "") as FeedIngredientCategory | ""
                )
              }
            >
              <option value="">{t("allCategories")}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {t("search")}
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{t("reviewLegend")}</p>

        {loadError ? (
          <p className="mb-3 text-sm text-destructive">{loadError}</p>
        ) : null}

        {loading ? (
          <p className="text-muted-foreground">…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {t("empty")}
          </p>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ category, items }) => {
              const isCollapsed = collapsed[category] === true;
              return (
                <Card key={category}>
                  <CardHeader className="py-3">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-left"
                      onClick={() =>
                        setCollapsed((c) => ({
                          ...c,
                          [category]: !isCollapsed
                        }))
                      }
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-4 shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 shrink-0" />
                      )}
                      <CardTitle className="text-base">
                        {t(`categories.${category}`)}
                      </CardTitle>
                      <Badge variant="outline" className="ml-2">
                        {items.length}
                      </Badge>
                    </button>
                  </CardHeader>
                  {!isCollapsed ? (
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[10rem]">
                              {t("canonicalName")}
                            </TableHead>
                            <TableHead>{t("fields.crudeProteinPct")}</TableHead>
                            <TableHead>
                              {t("fields.metabolizableEnergyKcal")}
                            </TableHead>
                            <TableHead>{t("fields.lysinePct")}</TableHead>
                            <TableHead>{t("fields.methioninePct")}</TableHead>
                            <TableHead>{t("fields.calciumPct")}</TableHead>
                            <TableHead>{t("fields.phosphorusPct")}</TableHead>
                            <TableHead>{t("fields.crudeFiberPct")}</TableHead>
                            <TableHead>{t("fields.fatPct")}</TableHead>
                            <TableHead>{t("fields.dryMatterPct")}</TableHead>
                            <TableHead>{t("reviewStatus")}</TableHead>
                            <TableHead>{t("status")}</TableHead>
                            <TableHead className="min-w-[11rem]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((row) => {
                            const draft =
                              drafts[row.id] ?? nutritionFromRow(row);
                            const dirty = isDirty(row, draft);
                            const saving = busyId === row.id;
                            const needsReview = !row.reviewedAt;
                            return (
                              <TableRow
                                key={row.id}
                                className={cn(
                                  !row.isActive && "opacity-60",
                                  needsReview && "bg-amber-50/40"
                                )}
                              >
                                <TableCell>
                                  <div className="font-medium">
                                    {row.canonicalName}
                                  </div>
                                  {row.aliases.length > 0 ? (
                                    <div className="text-xs text-muted-foreground">
                                      {row.aliases.join(", ")}
                                    </div>
                                  ) : null}
                                  {rowErrors[row.id] ? (
                                    <p className="mt-1 text-xs text-destructive">
                                      {rowErrors[row.id]}
                                    </p>
                                  ) : null}
                                </TableCell>
                                {NUTRITION_KEYS.map((key) => (
                                  <TableCell key={key} className="p-1">
                                    <Input
                                      type="number"
                                      step="any"
                                      className="h-8 w-[5.5rem] px-2 text-xs"
                                      value={
                                        Number.isFinite(draft[key])
                                          ? draft[key]
                                          : ""
                                      }
                                      onChange={(e) =>
                                        setDraftValue(
                                          row.id,
                                          key,
                                          e.target.value
                                        )
                                      }
                                      onBlur={() => {
                                        if (dirty) void saveRow(row);
                                      }}
                                      disabled={saving}
                                    />
                                  </TableCell>
                                ))}
                                <TableCell>
                                  <Badge
                                    variant={needsReview ? "destructive" : "outline"}
                                    title={
                                      row.reviewedAt
                                        ? t("reviewedAt", {
                                            date: new Date(
                                              row.reviewedAt
                                            ).toLocaleDateString("fr-FR")
                                          })
                                        : t("needsReviewHint")
                                    }
                                  >
                                    {needsReview
                                      ? t("needsReview")
                                      : t("reviewed")}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      row.isActive ? "outline" : "destructive"
                                    }
                                  >
                                    {row.isActive ? t("active") : t("inactive")}
                                  </Badge>
                                </TableCell>
                                <TableCell className="space-x-1 whitespace-nowrap">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={saving || !dirty}
                                    onClick={() => void saveRow(row)}
                                  >
                                    {saving ? "…" : t("save")}
                                  </Button>
                                  {needsReview ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={saving}
                                      onClick={() => void onMarkReviewed(row)}
                                    >
                                      {t("markReviewed")}
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      row.isActive ? "destructive" : "outline"
                                    }
                                    disabled={saving}
                                    onClick={() => void onToggle(row)}
                                  >
                                    {row.isActive
                                      ? t("deactivate")
                                      : t("reactivate")}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </AdminSection>

      <AdminSection icon={Package} title={t("formTitle")} bare>
        <Card>
          <CardHeader className="pb-2">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={() => setCreateOpen((v) => !v)}
            >
              <CardTitle className="text-base">{t("createTitle")}</CardTitle>
              {createOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
            <p className="text-xs text-muted-foreground">{t("createHint")}</p>
          </CardHeader>
          {createOpen ? (
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="fi-name">{t("canonicalName")}</Label>
                  <Input
                    id="fi-name"
                    value={form.canonicalName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        canonicalName: e.target.value
                      }))
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
                {NUTRITION_KEYS.map((key) => (
                  <div className="space-y-1" key={key}>
                    <Label htmlFor={`fi-create-${key}`}>
                      {t(`fields.${key}`)}
                    </Label>
                    <Input
                      id={`fi-create-${key}`}
                      type="number"
                      step="any"
                      value={form[key]}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          [key]: Number(e.target.value)
                        }))
                      }
                    />
                  </div>
                ))}
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="fi-iconKey">Pictogramme (iconKey)</Label>
                  <Input
                    id="fi-iconKey"
                    value={form.iconKey ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, iconKey: e.target.value }))
                    }
                    placeholder="cereal, plant_protein…"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fi-imageUrl">Image (URL)</Label>
                  <Input
                    id="fi-imageUrl"
                    value={form.imageUrl ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, imageUrl: e.target.value }))
                    }
                    placeholder="https://…"
                  />
                </div>
              </div>
              {createError ? (
                <p className="text-sm text-destructive">{createError}</p>
              ) : null}
              <Button
                type="button"
                disabled={createBusy || !form.canonicalName.trim()}
                onClick={() => void onCreate()}
              >
                {createBusy ? "…" : t("create")}
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </AdminSection>
    </AdminPageShell>
  );
}
