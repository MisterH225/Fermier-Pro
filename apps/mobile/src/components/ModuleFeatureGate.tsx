import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ClientConfigDto } from "../lib/api";
import { useSession } from "../context/SessionContext";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";

export type ClientFeatureKey = keyof ClientConfigDto["features"];

const TITLES: Record<ClientFeatureKey, string> = {
  marketplace: "Marché",
  chat: "Messagerie",
  vetConsultations: "Suivi vétérinaire",
  tasks: "Tâches terrain",
  finance: "Finance",
  housing: "Loges et parcours",
  feedStock: "Nutrition et stock aliments"
};

/**
 * Affiche les enfants uniquement si `GET /config/client` active ce module.
 */
export function ModuleFeatureGate({
  feature,
  children
}: {
  feature: ClientFeatureKey;
  children: ReactNode;
}) {
  const { clientFeatures } = useSession();
  if (!clientFeatures[feature]) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{TITLES[feature]} indisponible</Text>
        <Text style={styles.sub}>
          Cette fonctionnalité est désactivée sur ce serveur ou pour ta
          configuration.
        </Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xl,
    backgroundColor: mobileColors.canvas
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    textAlign: "center",
    marginBottom: mobileSpacing.sm
  },
  sub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  }
});
