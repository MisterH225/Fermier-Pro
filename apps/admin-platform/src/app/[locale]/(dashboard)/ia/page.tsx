"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  adminAiAsk,
  adminVetAssist,
  fetchAdminEpidemicAnalysis,
  fetchVetProfiles,
  type AdminAiAskResult,
  type AdminEpidemicAnalysis,
  type AdminVetAssistResult,
  type VetProfileRow
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/lib/ui-styles";

export default function IaPage() {
  const t = useTranslations("ai");
  const locale = useLocale();
  const { token, ready } = useAdminToken();

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
    fetchVetProfiles(token, { status: "pending" }).then(
      (rows) => {
        setPendingVets(rows);
        if (rows[0]) setSelectedVet(rows[0].id);
      }
    );
  }, [token]);

  const runEpidemic = async () => {
    if (!token) return;
    setEpidemicLoading(true);
    try {
      const res = await fetchAdminEpidemicAnalysis(token, locale);
      setEpidemic(res);
    } finally {
      setEpidemicLoading(false);
    }
  };

  const runAsk = async () => {
    if (!token || !question.trim()) return;
    setAskLoading(true);
    try {
      const res = await adminAiAsk(token, question.trim(), locale);
      setAskResult(res);
    } finally {
      setAskLoading(false);
    }
  };

  const runVetAssist = async () => {
    if (!token || !selectedVet) return;
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

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("epidemic.title")}</CardTitle>
          <CardDescription>{t("epidemic.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" disabled={epidemicLoading} onClick={runEpidemic}>
            {epidemicLoading ? "…" : t("epidemic.run")}
          </Button>
          {epidemic?.unavailable ? (
            <UnavailableNotice message={t("unavailable")} />
          ) : null}
          {epidemic && !epidemic.unavailable ? (
            <div className="space-y-3 text-sm">
              <p className="leading-relaxed">{epidemic.summary}</p>
              <ListBlock label={t("epidemic.emerging")} items={epidemic.emergingDiseases} />
              <ListBlock label={t("epidemic.riskZones")} items={epidemic.riskZones} />
              <ListBlock label={t("epidemic.trends")} items={epidemic.trends} />
              <ListBlock
                label={t("epidemic.recommendations")}
                items={epidemic.recommendations}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ask.title")}</CardTitle>
          <CardDescription>{t("ask.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-question">{t("ask.title")}</Label>
            <Textarea
              id="ai-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("ask.placeholder")}
              className="min-h-[100px]"
            />
          </div>
          <Button type="button" disabled={askLoading} onClick={runAsk}>
            {askLoading ? "…" : t("ask.run")}
          </Button>
          {askResult?.unavailable ? (
            <UnavailableNotice message={t("unavailable")} />
          ) : null}
          {askResult?.answer ? (
            <p className="text-sm whitespace-pre-wrap rounded-2xl glass-card p-4">
              {askResult.answer}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("vetAssist.title")}</CardTitle>
          <CardDescription>{t("vetAssist.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingVets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("vetAssist.none")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="vet-select">{t("vetAssist.title")}</Label>
                <select
                  id="vet-select"
                  value={selectedVet}
                  onChange={(e) => setSelectedVet(e.target.value)}
                  className={selectClass}
                >
                  {pendingVets.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.fullName} — {v.locationCountry}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={vetLoading}
                onClick={runVetAssist}
              >
                {vetLoading ? "…" : t("vetAssist.run")}
              </Button>
            </>
          )}
          {vetAssist?.unavailable ? (
            <UnavailableNotice message={t("unavailable")} />
          ) : null}
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
                <p className="sm:col-span-2 text-sm text-muted-foreground rounded-2xl border border-white/60 bg-white/40 p-3">
                  {vetAssist.notes}
                </p>
              ) : null}
              {vetAssist.diplomaImageAnalyzed ? (
                <div className="sm:col-span-2">
                  <Badge variant="success">
                    {t("vetAssist.imageAnalyzed")}
                  </Badge>
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">{t("vetAssist.disclaimer")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function UnavailableNotice({ message }: { message: string }) {
  return (
    <Badge variant="warning">
      {message}
    </Badge>
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
