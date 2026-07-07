import { useFeatureFlag } from "../hooks/useFeatureFlag";

type Props = {
  children: React.ReactNode;
};

/** Bloque l’UI boutique si le module `merchant` est désactivé côté plateforme. */
export function MerchantModuleGate({ children }: Props) {
  const enabled = useFeatureFlag("merchant");
  if (!enabled) {
    return null;
  }
  return <>{children}</>;
}
