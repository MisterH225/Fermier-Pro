"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Bot, CheckCircle2, Sparkles } from "lucide-react";
import {
  adminAiAsk,
  adminVetAssist,
  fetchAdminAiStatus,
  fetchAdminEpidemicAnalysis,
  fetchVetProfiles,
  type AdminAiAskResult,
  type AdminEpidemicAnalysis,
  type AdminVetAssistResult,
  type VetProfileRow
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSection } from "@/components/layout/AdminSection";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/lib/ui-styles";

export default function IaPage() {
  const t = useTranslations("ai");
  const locale = useLocale();
  const { token, ready } = useAdminToken();

  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [epidemic, setEpidemic] = useState<AdminEpidemicAnalysis | null>(null);
  const [epidemicLoading, setEpidemicLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [askResult, setAskResult] = useState<AdminAiAskResult | null>(null);
  const [askLoading, setAskLoading] = useState(false);

  const [pendingVets, setPendingVets] = useState<VetProfileRow[]>([]);
  const [selectedVet, setSelectedVet] = useState<string>("");
  const [vetAssist, setVetAssist] = useState<AdminVetAssistResult | null>(null);
  const [vetLoading, setVetLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchAdminAiStatus(token)
      .then((res) => setAiConfigured(res.configured))
      .catch(() => setAiConfigured(false));
    fetchVetProfiles(token, { status: "pending" }).then((rows) => {
      setPendingVets(rows);
      if (rows[0]) setSelectedVet(rows[0].id);
    });
  }, [token]);

  const runEpidemic = async () => {
    if (!token || !aiConfigured) return;
    setEpidemicLoading(true);
    try {
      const res = await fetchAdminEpidemicAnalysis(token, locale);
      setEpidemic(res);
    } finally {
      setEpidemicLoading(false);
    }
  };

  const runAsk = async () => {
    if (!token || !question.trim() || !aiConfigured) return;
    setAskLoading(true);
    try {
      const res = await adminAiAsk(token, question.trim(), locale);
      setAskResult(res);
    } finally {
      setAskLoading(false);
    }
  };

  const runVetAssist = async () => {
    if (!token || !selectedVet || !aiConfigured) return;
    setVetLoading(true);
    try {
      const res = await adminVetAssist(token, selectedVet, locale);
      setVetAssist(res);
    } finally {
      setVetLoading(false);
    }
  };

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  const aiDisabled = aiConfigured === false;

  return (
    <AdminPageShell>
      <PageHeader title={t("title")} description={t("pageLead")} />

      {aiConfigured === null ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : aiConfigured ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0" />
          {t("configured")}
        </div>
      ) : (
        <AiSetupBanner t={t} />
      )}

      <AdminSection
        icon={Sparkles}
        title={t("epidemic.title")}
        description={t("epidemic.description")}
        footer={
          <Button type="button" disabled={epidemicLoading || aiDisabled} onClick={runEpidemic}>
            {epidemicLoading ? "…" : t("epidemic.run")}
          </Button>
        }
      >
        {epidemic?.unavailable ? <UnavailableNotice message={t("unavailable")} /> : null}
        {epidemic && !epidemic.unavailable ? (
          <div className="space-y-3 text-sm">
            <p className="leading-relaxed">{epidemic.summary}</p>
            <ListBlock label={t("epidemic.emerging")} items={epidemic.emergingDiseases} />
            <ListBlock label={t("epidemic.riskZones")} items={epidemic.riskZones} />
            <ListBlock label={t("epidemic.trends")} items={epidemic.trends} />
            <ListBlock label={t("epidemic.recommendations")} items={epidemic.recommendations} />
          </div>
        ) : null}
      </AdminSection>

      <AdminSection
        icon={Bot}
        title={t("ask.title")}
        description={t("ask.description")}
        footer={
          <Button type="button" disabled={askLoading || aiDisabled} onClick={runAsk}>
            {askLoading ? "…" : t("ask.run")}
          </Button>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="ai-question">{t("ask.title")}</Label>
          <Textarea
            id="ai-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("ask.placeholder")}
            className="min-h-[100px]"
            disabled={aiDisabled}
          />
        </div>
        {askResult?.unavailable ? <UnavailableNotice message={t("unavailable")} /> : null}
        {askResult?.answer ? (
          <p className="text-sm whitespace-pre-wrap rounded-xl border bg-muted/30 p-4">
            {askResult.answer}
          </p>
        ) : null}
      </AdminSection>

      <AdminSection
        title={t("vetAssist.title")}
        description={t("vetAssist.description")}
        footer={
          pendingVets.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              disabled={vetLoading || aiDisabled}
              onClick={runVetAssist}
            >
              {vetLoading ? "…" : t("vetAssist.run")}
            </Button>
          ) : undefined
        }
      >
        {pendingVets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("vetAssist.none")}</p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="vet-select">{t("vetAssist.title")}</Label>
            <select
              id="vet-select"
              value={selectedVet}
              onChange={(e) => setSelectedVet(e.target.value)}
              className={selectClass}
              disabled={aiDisabled}
            >
              {pendingVets.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.fullName} — {v.locationCountry}
                </option>
              ))}
            </select>
          </div>
        )}
        {vetAssist?.unavailable ? <UnavailableNotice message={t("unavailable")} /> : null}
        {vetAssist && !vetAssist.unavailable ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <KpiCard
              label={t("vetAssist.confidence")}
              value={`${vetAssist.confidenceScore} %`}
              variant="blue"
            />
            <KpiCard
              label={t("vetAssist.recommendation")}
              value={t(`vetAssist.rec.${vetAssist.recommendation}` as "vetAssist.rec.review")}
              variant="sky"
            />
            <KpiCard
              label={t("vetAssist.diploma")}
              value={vetAssist.readableDiploma}
              variant="purple"
            />
            <KpiCard
              label={t("vetAssist.consistent")}
              value={vetAssist.infoConsistent ? t("vetAssist.yes") : t("vetAssist.no")}
              variant="warning"
            />
            {vetAssist.notes ? (
              <p className="sm:col-span-2 text-sm text-muted-foreground rounded-xl border bg-muted/30 p-3">
                {vetAssist.notes}
              </p>
            ) : null}
            {vetAssist.diplomaImageAnalyzed ? (
              <div className="sm:col-span-2">
                <Badge variant="success">{t("vetAssist.imageAnalyzed")}</Badge>
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("vetAssist.disclaimer")}</p>
      </AdminSection>
    </AdminPageShell>
  );
}

function AiSetupBanner({ t }: { t: ReturnType<typeof useTranslations<"ai">> }) {
  return (
    <div className="rounded-3xl border border-amber-500/30 bg-amber-500/8 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="size-10 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <AlertTriangle className="size-5 text-amber-600" />
        </span>
        <div className="space-y-1 min-w-0">
          <p className="font-bold text-foreground">{t("setupTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("setupBody")}</p>
        </div>
      </div>
      <ul className="text-sm text-muted-foreground space-y-2 pl-1">
        <li className="flex gap-2">
          <span className="font-mono text-xs bg-white/60 border border-white/60 rounded-lg px-2 py-1 shrink-0">
            GEMINI_API_KEY
          </span>
          <span>{t("setupLocal")}</span>
        </li>
        <li>{t("setupRailway")}</li>
        <li>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline"
          >
            {t("setupLink")}
          </a>
        </li>
      </ul>
    </div>
  );
}

function UnavailableNotice({ message }: { message: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-900">
      <AlertTriangle className="size-4 shrink-0" />
      {message}
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="font-semibold">{label}</p>
      <ul className="list-disc pl-5 mt-1 space-y-0.5 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
