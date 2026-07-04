"use client";

import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

const E2IA_LOGO = "/images/e2ia-logo.svg";
const FERMIER_LOGO = "/images/fermier-pro-logo-nobg.png";
const FERMIER_LOGO_ASPECT = 601 / 295;

const STORY_PHOTOS = [
  {
    src: "/images/landing/story-farmer-africa.jpg",
    altKey: "photoFarmer" as const,
    className: "col-span-2 row-span-2"
  },
  {
    src: "/images/landing/story-pigs-farm.jpg",
    altKey: "photoPigs" as const,
    className: "col-span-1 row-span-1"
  },
  {
    src: "/images/landing/story-piglets.jpg",
    altKey: "photoPiglets" as const,
    className: "col-span-1 row-span-1"
  }
];

const PROBLEM_KEYS = ["traceability", "finance", "feed", "actors"] as const;

export function FounderStory({ onContact }: { onContact: () => void }) {
  const t = useTranslations("login.landing.story");

  return (
    <section id="story" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Photos terrain */}
          <div className="relative">
            <div className="grid min-h-[360px] grid-cols-2 grid-rows-2 gap-3 sm:min-h-[420px] sm:gap-4">
              {STORY_PHOTOS.map((photo) => (
                <div
                  key={photo.src}
                  className={`relative min-h-[120px] overflow-hidden rounded-3xl shadow-xl ${photo.className}`}
                >
                  <Image
                    src={photo.src}
                    alt={t(`photos.${photo.altKey}`)}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 50vw, 400px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                </div>
              ))}
            </div>
            <div className="absolute -bottom-5 -right-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-lg sm:-right-5">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-olive">{t("photoBadge")}</p>
              <p className="text-sm font-semibold text-gray-800">{t("photoCaption")}</p>
            </div>
          </div>

          {/* Récit */}
          <div>
            <div className="flex flex-wrap items-center gap-6">
              <Image
                src={E2IA_LOGO}
                alt="E2IA — Entreprise Ivoirienne d'Innovation Agricole"
                width={88}
                height={104}
                className="h-20 w-auto"
              />
              <span className="hidden text-2xl text-gray-300 sm:inline">→</span>
              <Image
                src={FERMIER_LOGO}
                alt="Fermier Pro"
                width={140}
                height={Math.round(140 / FERMIER_LOGO_ASPECT)}
                className="h-14 w-auto object-contain"
              />
            </div>

            <p className="farm-label mt-8">{t("badge")}</p>
            <h2 className="farm-title mt-3 normal-case leading-tight">{t("title")}</h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">{t("lead")}</p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{t("body")}</p>

            <blockquote className="mt-8 border-l-4 border-brand-olive bg-[#f8faf6] px-5 py-4 italic text-gray-700">
              {t("quote")}
            </blockquote>
          </div>
        </div>

        {/* Problèmes réels */}
        <div className="mt-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="farm-label">{t("problems.badge")}</p>
            <h3 className="mt-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">{t("problems.title")}</h3>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEM_KEYS.map((key) => (
              <article key={key} className="farm-card !p-6">
                <CheckCircle2 className="size-6 text-brand-olive" strokeWidth={2.2} />
                <h4 className="mt-4 font-extrabold text-gray-900">{t(`problems.items.${key}.title`)}</h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`problems.items.${key}.body`)}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-12 rounded-[2rem] bg-gradient-to-r from-[#1f4d2d] to-brand-olive p-8 text-center text-white sm:p-10">
            <p className="text-lg font-semibold sm:text-xl">{t("solution.lead")}</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              {t("solution.body")}
            </p>
            <button type="button" onClick={onContact} className="farm-btn mt-6 bg-white text-brand-olive hover:bg-gray-100">
              {t("solution.cta")}
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
