"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { PhoneFrame } from "./PhoneFrame";
import {
  BuildingsMockup,
  DashboardMockup,
  FinanceReportMockup,
  HerdOverviewMockup,
  HomeScreenMockup,
  MarketplaceMockup
} from "./AppScreenMockups";
import { cn } from "@/lib/utils";

function ShowcaseCard({
  title,
  body,
  children,
  reverse = false,
  accent
}: {
  title: string;
  body: string;
  children: React.ReactNode;
  reverse?: boolean;
  accent: string;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-10 lg:grid-cols-2 lg:gap-16",
        reverse && "lg:[&>div:first-child]:order-2"
      )}
    >
      <div className="relative flex justify-center">
        <div
          className="absolute -inset-6 rounded-[3rem] opacity-60 blur-3xl"
          style={{ background: accent }}
        />
        <div className="relative w-[min(100%,260px)]">{children}</div>
      </div>
      <div>
        <h3 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{title}</h3>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{body}</p>
      </div>
    </div>
  );
}

export function ProductShowcase({ onContact }: { onContact: () => void }) {
  const t = useTranslations("login.landing.showcase");

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#f8faf6] to-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="farm-label">{t("badge")}</p>
          <h2 className="farm-title mt-3 normal-case">{t("title")}</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{t("lead")}</p>
        </div>

        {/* Hero phones bento */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="grid place-items-center gap-10 md:grid-cols-[1fr_auto_1fr] md:items-end">
            <PhoneFrame model="samsung" className="max-w-[220px] -rotate-6 md:translate-y-10" glow="warm">
              <HerdOverviewMockup />
            </PhoneFrame>
            <PhoneFrame model="iphone" className="relative z-10 max-w-[270px]" glow="neutral">
              <HomeScreenMockup />
            </PhoneFrame>
            <PhoneFrame model="samsung" className="max-w-[220px] rotate-6 md:translate-y-10" glow="purple">
              <MarketplaceMockup />
            </PhoneFrame>
          </div>
        </div>

        <div className="mt-24 space-y-24">
          <ShowcaseCard
            title={t("herd.title")}
            body={t("herd.body")}
            accent="radial-gradient(circle, rgba(244,114,182,0.25), transparent 70%)"
          >
            <PhoneFrame model="iphone" glow="warm">
              <BuildingsMockup />
            </PhoneFrame>
          </ShowcaseCard>

          <ShowcaseCard
            title={t("finance.title")}
            body={t("finance.body")}
            reverse
            accent="radial-gradient(circle, rgba(92,107,58,0.22), transparent 70%)"
          >
            <PhoneFrame model="iphone" glow="neutral">
              <FinanceReportMockup />
            </PhoneFrame>
          </ShowcaseCard>

          <ShowcaseCard
            title={t("ai.title")}
            body={t("ai.body")}
            accent="radial-gradient(circle, rgba(251,191,36,0.22), transparent 70%)"
          >
            <PhoneFrame model="iphone" glow="warm">
              <DashboardMockup />
            </PhoneFrame>
          </ShowcaseCard>
        </div>

        <div className="mt-20 text-center">
          <p className="text-lg font-semibold text-gray-800">{t("ctaLead")}</p>
          <button type="button" onClick={onContact} className="farm-btn mt-6">
            {t("cta")}
            <ArrowRight className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
