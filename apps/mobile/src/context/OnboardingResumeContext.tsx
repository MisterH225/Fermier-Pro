import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

type Ctx = {
  resumeActive: boolean;
  requestResume: () => void;
  clearResume: () => void;
};

const OnboardingResumeContext = createContext<Ctx | null>(null);

export function OnboardingResumeProvider({ children }: { children: ReactNode }) {
  const [resumeActive, setResumeActive] = useState(false);
  const requestResume = useCallback(() => setResumeActive(true), []);
  const clearResume = useCallback(() => setResumeActive(false), []);
  const value = useMemo(
    () => ({ resumeActive, requestResume, clearResume }),
    [resumeActive, requestResume, clearResume]
  );
  return (
    <OnboardingResumeContext.Provider value={value}>
      {children}
    </OnboardingResumeContext.Provider>
  );
}

export function useOnboardingResume() {
  const ctx = useContext(OnboardingResumeContext);
  if (!ctx) {
    throw new Error("useOnboardingResume hors OnboardingResumeProvider");
  }
  return ctx;
}
