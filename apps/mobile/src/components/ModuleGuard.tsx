import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PlatformModuleId } from "../lib/api";
import { useFeatureFlag } from "../hooks/useFeatureFlag";

const TITLES: Partial<Record<PlatformModuleId, string>> = {
  core_producer: "Producteur",
  technician: "Tâches terrain",
  veterinarian: "Suivi vétérinaire",
  marketplace: "Marché",
  buyer: "Acheteur",
  collaboration: "Messagerie",
  reports: "Rapports",
  ai_assistant: "Assistant IA",
  pig_price_index: "PigPrice Index",
  gestation: "Gestation",
  nutrition: "Nutrition"
};

type Props = {
  moduleId: PlatformModuleId;
  children: ReactNode;
  title?: string;
};

/** Bloque l'accès si le module plateforme est inactif. */
export function ModuleGuard({ moduleId, children, title }: Props) {
  const { isActive, message } = useFeatureFlag(moduleId);
  if (isActive) {
    return <>{children}</>;
  }
  return (
    <InactiveModuleScreen
      title={title ?? TITLES[moduleId] ?? moduleId}
      message={message}
    />
  );
}

export function InactiveModuleScreen({
  title,
  message
}: {
  title: string;
  message?: string | null;
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{title} indisponible</Text>
      <Text style={styles.sub}>
        {message ??
          "Cette fonctionnalité est temporairement désactivée sur la plateforme."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2910",
    textAlign: "center",
    marginBottom: 10
  },
  sub: {
    fontSize: 14,
    color: "#6d745b",
    textAlign: "center",
    lineHeight: 20
  }
});
