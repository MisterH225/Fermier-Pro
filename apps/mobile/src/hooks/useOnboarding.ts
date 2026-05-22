import { useCallback, useMemo, useState } from "react";
import type { CompleteOnboardingPayload } from "../lib/api";

export type OnboardingLocation =
  | { mode: "gps"; label: string; latitude: number; longitude: number }
  | { mode: "manual"; label: string }
  | null;

export type OnboardingFormState = {
  farmName: string;
  speciesFocus: string;
  location: OnboardingLocation;
  femaleBreeders: string;
  maleBreeders: string;
  starterHeadcount: string;
  fatteningHeadcount: string;
  buildingsCount: string;
  pensPerBuilding: string;
  maxPigsPerPen: string;
};

const INITIAL: OnboardingFormState = {
  farmName: "",
  speciesFocus: "porcin",
  location: null,
  femaleBreeders: "",
  maleBreeders: "",
  starterHeadcount: "",
  fatteningHeadcount: "",
  buildingsCount: "2",
  pensPerBuilding: "4",
  maxPigsPerPen: "12"
};

function parseNonNegInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}

function parsePosInt(raw: string): number | null {
  const n = parseNonNegInt(raw);
  if (n === null || n < 1) {
    return null;
  }
  return n;
}

export function useOnboarding() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingFormState>(INITIAL);

  const patch = useCallback((partial: Partial<OnboardingFormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  const femaleN = parseNonNegInt(form.femaleBreeders);
  const maleN = parseNonNegInt(form.maleBreeders);
  const starterN = parseNonNegInt(form.starterHeadcount);
  const fatteningN = parseNonNegInt(form.fatteningHeadcount);
  const buildingsN = parsePosInt(form.buildingsCount);
  const pensN = parsePosInt(form.pensPerBuilding);
  const capN = parsePosInt(form.maxPigsPerPen);

  const breedersTotal = (femaleN ?? 0) + (maleN ?? 0);
  const productionTotal = (starterN ?? 0) + (fatteningN ?? 0);
  const headcountTotal = breedersTotal + productionTotal;

  const totalPens =
    buildingsN != null && pensN != null ? buildingsN * pensN : null;
  const totalCapacity =
    totalPens != null && capN != null ? totalPens * capN : null;
  const occupancyPct =
    totalCapacity != null && totalCapacity > 0
      ? Math.min(100, Math.round((headcountTotal / totalCapacity) * 1000) / 10)
      : null;

  const step1Valid =
    form.farmName.trim().length > 0 &&
    form.speciesFocus.length > 0 &&
    form.location != null &&
    (form.location.mode === "manual"
      ? form.location.label.trim().length > 0
      : true);

  const step2Valid = femaleN !== null && maleN !== null;
  const step3Valid = starterN !== null && fatteningN !== null;
  const step4Valid =
    buildingsN !== null && pensN !== null && capN !== null;

  const stepValid = [step1Valid, step2Valid, step3Valid, step4Valid];

  const canNext = step < 4 ? stepValid[step] : false;

  const toPayload = useCallback((): CompleteOnboardingPayload | null => {
    if (!step1Valid || !step2Valid || !step3Valid || !step4Valid) {
      return null;
    }
    const loc = form.location!;
    return {
      farmName: form.farmName.trim(),
      speciesFocus: form.speciesFocus,
      locationSource: loc.mode,
      locationLabel: loc.label.trim() || undefined,
      latitude: loc.mode === "gps" ? loc.latitude : undefined,
      longitude: loc.mode === "gps" ? loc.longitude : undefined,
      femaleBreeders: femaleN!,
      maleBreeders: maleN!,
      starterHeadcount: starterN!,
      fatteningHeadcount: fatteningN!,
      buildingsCount: buildingsN!,
      pensPerBuilding: pensN!,
      maxPigsPerPen: capN!
    };
  }, [
    step1Valid,
    step2Valid,
    step3Valid,
    step4Valid,
    form,
    femaleN,
    maleN,
    starterN,
    fatteningN,
    buildingsN,
    pensN,
    capN
  ]);

  const reset = useCallback(() => {
    setStep(0);
    setForm(INITIAL);
  }, []);

  return useMemo(
    () => ({
      step,
      setStep,
      form,
      patch,
      canNext,
      stepValid,
      breedersTotal,
      headcountTotal,
      totalPens,
      totalCapacity,
      occupancyPct,
      toPayload,
      reset,
      showBreederWarning: step2Valid && breedersTotal === 0
    }),
    [
      step,
      form,
      patch,
      canNext,
      stepValid,
      breedersTotal,
      headcountTotal,
      totalPens,
      totalCapacity,
      occupancyPct,
      toPayload,
      reset,
      step2Valid
    ]
  );
}
