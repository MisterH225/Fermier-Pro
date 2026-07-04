"use client";

import Image from "next/image";
import {
  ArrowRight,
  Baby,
  Brain,
  Building2,
  HeartPulse,
  Leaf,
  Mail,
  Map,
  Phone,
  PiggyBank,
  ShoppingCart,
  Sprout,
  Tractor,
  UtensilsCrossed
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { verifyAdminSuperUser } from "@/lib/admin-auth";
import { useRouter } from "@/i18n/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAdminOAuthRedirectTo,
  setAdminOAuthNextCookie
} from "@/lib/admin-oauth";
import { cn } from "@/lib/utils";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { PhoneFrame } from "@/components/landing/PhoneFrame";
import {
  DashboardMockup,
  FinanceReportMockup,
  HerdOverviewMockup,
  HomeScreenMockup,
  MarketplaceMockup
} from "@/components/landing/AppScreenMockups";

const MODULE_KEYS = [
  "finance",
  "herd",
  "gestation",
  "feeding",
  "marketplace",
  "health",
  "sanitaryMap",
  "ai"
] as const;

const MODULE_SCREEN: Partial<Record<(typeof MODULE_KEYS)[number], "home" | "herd" | "market" | "finance" | "dashboard">> = {
  finance: "finance",
  herd: "herd",
  gestation: "herd",
  feeding: "home",
  marketplace: "market",
  health: "dashboard",
  sanitaryMap: "dashboard",
  ai: "dashboard"
};

const MODULE_ICONS: Record<(typeof MODULE_KEYS)[number], typeof Leaf> = {
  finance: PiggyBank,
  herd: Tractor,
  gestation: Baby,
  feeding: UtensilsCrossed,
  marketplace: ShoppingCart,
  health: HeartPulse,
  sanitaryMap: Map,
  ai: Brain
};

const PILLAR_KEYS = ["actors", "traceability", "impact"] as const;

const NAV_KEYS = ["ambition", "modules", "contact"] as const;

const STAT_KEYS = ["farms", "animals", "presence"] as const;

const LOGO_SRC = "/images/fermier-pro-logo-nobg.png";
const LOGO_ASPECT = 601 / 295;

function LogoMark({
  className,
  variant = "light",
  size = "md",
  centered = false,
  showBadge = true
}: {
  className?: string;
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  centered?: boolean;
  showBadge?: boolean;
}) {
  const widths = { sm: 130, md: 160, lg: 200 };
  const w = widths[size];
  const h = Math.round(w / LOGO_ASPECT);
  const isLight = variant === "light";

  return (
    <div className={cn("flex flex-col gap-1.5", centered && "items-center", className)}>
      <Image
        src={LOGO_SRC}
        alt="Fermier Pro"
        width={w}
        height={h}
        priority
        className={cn(
          "object-contain",
          centered ? "object-center" : "object-left",
          isLight && "brightness-0 invert drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
        )}
      />
      {showBadge && size !== "sm" ? (
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.25em]",
            centered && "text-center",
            isLight ? "text-white/80" : "text-brand-olive"
          )}
        >
          SuperAdmin
        </span>
      ) : null}
    </div>
  );
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ModulePhonePreview({ screen }: { screen: NonNullable<(typeof MODULE_SCREEN)[keyof typeof MODULE_SCREEN]> }) {
  const content = {
    home: <HomeScreenMockup />,
    herd: <HerdOverviewMockup />,
    market: <MarketplaceMockup />,
    finance: <FinanceReportMockup />,
    dashboard: <DashboardMockup />
  }[screen];

  return (
    <PhoneFrame className="mx-auto max-w-[200px]" glow="neutral">
      {content}
    </PhoneFrame>
  );
}

function LoginForm({
  t,
  email,
  setEmail,
  password,
  setPassword,
  error,
  loading,
  googleLoading,
  onSubmit,
  onGoogle,
  inDialog = false
}: {
  t: ReturnType<typeof useTranslations<"login">>;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  error: string | null;
  loading: boolean;
  googleLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onGoogle: () => void;
  inDialog?: boolean;
}) {
  return (
    <div className={cn(!inDialog && "farm-card w-full max-w-md")}>
      <div className={cn("text-center", inDialog ? "mb-5" : "mb-6")}>
        <LogoMark variant="dark" size={inDialog ? "sm" : "md"} centered showBadge={false} />
        <h2 className={cn("font-extrabold text-gray-900", inDialog ? "mt-3 text-xl" : "mt-4 text-2xl")}>
          {t("title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("formLead")}</p>
      </div>

      <button
        type="button"
        disabled={googleLoading}
        onClick={onGoogle}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-6 py-3.5 text-sm font-bold text-foreground transition hover:bg-gray-100 disabled:opacity-60"
      >
        <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {googleLoading ? "…" : t("google")}
      </button>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-dashed border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("orEmail")}
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-bold">
            {t("email")}
          </Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-2xl border-gray-200 px-5 font-medium"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-bold">
            {t("password")}
          </Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-2xl border-gray-200 px-5 font-medium"
          />
        </div>

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={loading} className="farm-btn w-full disabled:opacity-60">
          {loading ? "…" : t("submit")}
          {!loading ? <ArrowRight className="size-5" /> : null}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">{t("googleHint")}</p>
    </div>
  );
}

export function LoginScreen() {
  const t = useTranslations("login");
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "oauth") {
      const reason = searchParams.get("reason");
      setError(reason ? t("oauthCallbackError", { reason }) : t("oauthRedirectError"));
      setLoginOpen(true);
    }
    if (searchParams.get("error") === "api") {
      setError(t("apiUnreachable"));
      setLoginOpen(true);
    }
  }, [searchParams, t]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (signErr || !data.session?.access_token) {
        setError(t("errorGoogleHint"));
        return;
      }
      if (!(await verifyAdminSuperUser(data.session.access_token))) {
        await supabase.auth.signOut();
        setError(t("forbidden"));
        return;
      }
      router.replace("/");
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      setAdminOAuthNextCookie(locale);
      const redirectTo = getAdminOAuthRedirectTo();
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true
        }
      });
      if (oauthErr) {
        setError(oauthErr.message);
        return;
      }
      const oauthUrl = data?.url?.trim();
      if (!oauthUrl?.startsWith("https://")) {
        setError(t("oauthNoUrl"));
        return;
      }
      window.location.href = oauthUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("NEXT_PUBLIC_SUPABASE")) {
        setError(t("oauthEnvMissing"));
      } else {
        setError(t("oauthNoUrl"));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const loginFormProps = {
    t,
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    googleLoading,
    onSubmit,
    onGoogle
  };

  return (
    <div className="min-h-screen farm-landing-bg">
      {/* Hero */}
      <section id="top" className="relative overflow-hidden bg-gradient-to-br from-[#2d3a24] via-[#3d4a28] to-[#1a2114]">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, rgba(141,187,97,0.35), transparent 45%),
              radial-gradient(circle at 80% 10%, rgba(255,255,255,0.08), transparent 40%)`
          }}
        />

        {/* Nav overlay */}
        <header className="relative z-20">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
            <button type="button" onClick={() => scrollToSection("top")}>
              <LogoMark variant="light" size="sm" showBadge={false} />
            </button>

            <nav className="hidden items-center gap-8 md:flex">
              {NAV_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => scrollToSection(key)}
                  className="text-sm font-semibold text-white/90 transition hover:text-white"
                >
                  {t(`landing.nav.${key}`)}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="farm-btn px-5 py-2.5 text-xs sm:text-sm"
            >
              {t("navSignIn")}
            </button>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden">
            {NAV_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => scrollToSection(key)}
                className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
              >
                {t(`landing.nav.${key}`)}
              </button>
            ))}
          </nav>
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pb-20 lg:pt-12">
          <div className="text-center text-white lg:text-left">
            <p className="farm-label text-white/70">{t("landing.hero.present")}</p>

            <h1 className="mt-4 text-4xl font-extrabold uppercase leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              {t("hero.titleHighlight")}
              <br />
              <span className="text-white">{t("hero.titleRest")}</span>
            </h1>

            <p className="mt-4 font-script text-3xl text-[#b8d4a0] sm:text-4xl">
              {t("landing.hero.scriptAccent")}
            </p>

            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg lg:mx-0">
              {t("landing.heroLead")}
            </p>

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <button
                type="button"
                onClick={() => scrollToSection("showcase")}
                className="farm-btn"
              >
                {t("landing.hero.discover")}
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("contact")}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                {t("landing.ambition.cta")}
                <ArrowRight className="size-4" />
              </button>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 text-center lg:max-w-lg">
              {STAT_KEYS.map((key) => (
                <div key={key} className="rounded-2xl border border-white/15 bg-white/10 px-2 py-3 backdrop-blur-sm">
                  <p
                    className={cn(
                      "font-extrabold text-white",
                      key === "presence" ? "text-sm leading-tight sm:text-base" : "text-lg"
                    )}
                  >
                    {t(`hero.stats.${key}.value`)}
                  </p>
                  <p className="mt-1 text-[10px] font-medium leading-snug text-white/70">
                    {t(`hero.stats.${key}.label`)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-white/55 lg:text-left">
              {t("landing.hero.presenceHint")}
            </p>
          </div>

          <div className="relative mx-auto flex w-full max-w-md items-end justify-center lg:max-w-none lg:justify-end">
            <PhoneFrame
              model="iphone"
              className="absolute -left-4 bottom-0 z-0 w-[42%] max-w-[200px] -rotate-[14deg] scale-95 opacity-95 lg:-left-8"
              glow="warm"
            >
              <HerdOverviewMockup />
            </PhoneFrame>
            <PhoneFrame model="iphone" className="relative z-10 w-[52%] max-w-[240px]" glow="neutral">
              <HomeScreenMockup />
            </PhoneFrame>
          </div>
        </div>
      </section>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-gray-100 bg-white p-6 sm:p-8">
          <DialogTitle className="sr-only">{t("title")}</DialogTitle>
          <LoginForm {...loginFormProps} inDialog />
        </DialogContent>
      </Dialog>

      {/* Why cards */}
      <section className="relative py-20 sm:py-28">
        <Image
          src={LOGO_SRC}
          alt=""
          width={280}
          height={138}
          className="pointer-events-none absolute right-4 top-8 opacity-[0.06] sm:right-12 sm:top-12"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="farm-label">{t("landing.why.badge")}</p>
            <h2 className="farm-title mt-3">{t("landing.why.title")}</h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {PILLAR_KEYS.map((key) => (
              <article key={key} className="farm-card">
                <div className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-brand-olive">
                  <Sprout className="size-4" />
                  {t(`landing.ambition.points.${key}.title`)}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.ambition.points.${key}.body`)}
                </p>
                <button
                  type="button"
                  onClick={() => scrollToSection("ambition")}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-olive transition hover:gap-3"
                >
                  {t("landing.hero.learnMore")}
                  <ArrowRight className="size-4" />
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Ambition / About */}
      <section id="ambition" className="scroll-mt-24 bg-white py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative flex justify-center">
            <div className="absolute -inset-8 rounded-full bg-[#5C6B3A]/10 blur-3xl" />
            <PhoneFrame model="iphone" className="relative max-w-[280px]" glow="neutral">
              <HerdOverviewMockup />
            </PhoneFrame>
            <span className="absolute right-4 top-4 rounded-full bg-brand-olive px-4 py-2 text-xs font-bold text-white shadow-lg sm:right-8">
              {t("landing.ambition.organicBadge")}
            </span>
          </div>

          <div>
            <p className="farm-label">{t("landing.ambition.badge")}</p>
            <h2 className="farm-title mt-3 normal-case">{t("landing.ambition.title")}</h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("landing.ambition.lead")}
            </p>
            <button
              type="button"
              onClick={() => scrollToSection("contact")}
              className="farm-btn mt-8"
            >
              {t("landing.ambition.cta")}
            </button>
          </div>
        </div>
      </section>

      <div id="showcase" className="scroll-mt-24">
        <ProductShowcase onContact={() => scrollToSection("contact")} />
      </div>

      {/* Modules */}
      <section id="modules" className="scroll-mt-24 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="farm-label">{t("landing.modules.badge")}</p>
            <h2 className="farm-title mt-3 normal-case">{t("landing.modules.title")}</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("landing.modules.lead")}
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {MODULE_KEYS.map((key) => {
              const Icon = MODULE_ICONS[key];
              const screen = MODULE_SCREEN[key];
              return (
                <article
                  key={key}
                  className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.1)]"
                >
                  <div className="relative overflow-hidden bg-gradient-to-b from-[#f8faf6] to-white px-4 pb-2 pt-4">
                    {screen ? <ModulePhonePreview screen={screen} /> : null}
                    <span className="absolute left-6 top-6 inline-flex size-10 items-center justify-center rounded-xl bg-white text-brand-olive shadow-md">
                      <Icon className="size-5" strokeWidth={2.2} />
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-extrabold text-gray-900">
                      {t(`landing.modules.items.${key}.title`)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`landing.modules.items.${key}.body`)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-24 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[2rem] bg-brand-olive shadow-2xl">
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className="text-white">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                  {t("landing.contact.badge")}
                </p>
                <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">{t("landing.contact.title")}</h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
                  {t("landing.contact.lead")}
                </p>
                <button
                  type="button"
                  onClick={() => scrollToSection("showcase")}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
                >
                  {t("landing.contact.seeApp")}
                  <ArrowRight className="size-4" />
                </button>
              </div>

              <div className="space-y-4">
                <a
                  href="mailto:info.e2ia@gmail.com"
                  className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white/15">
                    <Mail className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/70">Email</p>
                    <p className="font-bold">info.e2ia@gmail.com</p>
                  </div>
                </a>

                <a
                  href="tel:+2250757543447"
                  className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white/15">
                    <Phone className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                      {t("landing.contact.phone")}
                    </p>
                    <p className="font-bold">+225 07 57 54 34 47</p>
                  </div>
                </a>

                <a
                  href="tel:+2250708425141"
                  className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white/15">
                    <Building2 className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                      {t("landing.contact.phoneAlt")}
                    </p>
                    <p className="font-bold">+225 07 08 42 51 41</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} E2IA — Fermier Pro</p>
          <p>{t("landing.footer")}</p>
        </div>
      </footer>
    </div>
  );
}
