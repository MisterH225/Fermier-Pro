import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { VetReadingDto } from "../../../lib/api/vet";
import type { RootStackParamList } from "../../../types/navigation";
import {
  vetColors,
  vetRadius,
  vetShadow,
  vetType
} from "../../../theme/vetTheme";
import { mobileSpacing } from "../../../theme/mobileTheme";

type Props = {
  reading: VetReadingDto | null | undefined;
  farmId: string;
  farmName: string;
  /** Nom du lot pour l'action open_batch (si connu). */
  batchName?: string | null;
};

/**
 * Encart « Lecture vétérinaire » — max 1 par onglet, uniquement si une règle
 * serveur est déclenchée. Aucun texte creux.
 */
export function VetReadingCard({
  reading,
  farmId,
  farmName,
  batchName
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (!reading) {
    return null;
  }

  const message =
    reading.kind === "density_gmq"
      ? t(reading.messageKey, { barn: reading.barnName ?? "" })
      : t(reading.messageKey);

  const onAction = () => {
    if (reading.action === "open_batch" && reading.batchId) {
      navigation.navigate("BatchDetail", {
        farmId,
        farmName,
        batchId: reading.batchId,
        batchName: batchName ?? reading.batchId
      });
      return;
    }
    if (reading.action === "schedule_visit") {
      navigation.navigate("VetAgenda");
    }
  };

  const actionLabel =
    reading.action === "open_batch"
      ? t("vet.farmDetail.readings.openBatch")
      : t("vet.farmDetail.readings.scheduleVisit");

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={t("vet.farmDetail.readings.title")}
    >
      <View style={styles.head}>
        <Ionicons
          name="medical"
          size={18}
          color={vetColors.primaryDark}
        />
        <Text style={styles.title}>
          {t("vet.farmDetail.readings.title")}
        </Text>
      </View>
      <Text style={styles.body}>{message}</Text>
      <Pressable
        style={styles.btn}
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.btnTx}>{actionLabel}</Text>
        <Ionicons
          name="arrow-forward"
          size={14}
          color={vetColors.onPrimary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: vetColors.primaryLight,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: vetColors.primary,
    marginTop: mobileSpacing.md,
    ...vetShadow.soft
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  title: { ...vetType.title, color: vetColors.primaryDark },
  body: { ...vetType.body, color: vetColors.textPrimary, lineHeight: 20 },
  btn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: vetColors.primary,
    borderRadius: vetRadius.button,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  btnTx: {
    color: vetColors.onPrimary,
    fontWeight: "700",
    fontSize: 12
  }
});
