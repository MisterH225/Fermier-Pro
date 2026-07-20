import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../../../context/SessionContext";
import {
  fetchFarmHealthEvents,
  fetchVetConsultations
} from "../../../lib/api";
import { vetColors, vetRadius } from "../../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../../theme/mobileTheme";
import type { RootStackParamList } from "../../../types/navigation";

type Props = {
  farmId: string;
  farmName: string;
  locale: string;
};

type RxItem = {
  id: string;
  title: string;
  at: string;
  kind: "attachment" | "prescription_url" | "consultation";
  url?: string | null;
  consultationId?: string;
};

export function VetFarmPrescriptionsTab({
  farmId,
  farmName,
  locale
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();

  const consultsQ = useQuery({
    queryKey: ["vetFarmConsults", farmId, activeProfileId],
    queryFn: () =>
      fetchVetConsultations(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const visitsQ = useQuery({
    queryKey: ["vetFarmVetVisits", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmHealthEvents(accessToken!, farmId, activeProfileId, {
        kind: "vet_visit"
      }),
    enabled: Boolean(accessToken)
  });

  const items = useMemo((): RxItem[] => {
    const rows: RxItem[] = [];

    for (const c of consultsQ.data ?? []) {
      if (c.attachments.length > 0) {
        rows.push({
          id: `c-att-${c.id}`,
          title: c.subject,
          at: c.openedAt,
          kind: "attachment",
          consultationId: c.id
        });
      } else if (c.summary?.trim()) {
        rows.push({
          id: `c-${c.id}`,
          title: c.subject,
          at: c.openedAt,
          kind: "consultation",
          consultationId: c.id
        });
      }
    }

    for (const v of visitsQ.data ?? []) {
      const url = v.attachmentUrl ?? v.vetVisit?.prescriptionUrl ?? null;
      if (url) {
        rows.push({
          id: `v-${v.id}`,
          title:
            v.vetVisit?.reason ??
            v.vetVisit?.vetName ??
            t("vet.farmDetail.prescriptionFallback"),
          at: v.occurredAt,
          kind: "prescription_url",
          url
        });
      }
    }

    return rows.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }, [consultsQ.data, visitsQ.data, t]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

  if (consultsQ.isLoading || visitsQ.isLoading) {
    return <ActivityIndicator color={vetColors.primary} />;
  }

  if (items.length === 0) {
    return (
      <Text style={styles.empty}>{t("vet.farmDetail.noPrescriptions")}</Text>
    );
  }

  return (
    <View style={styles.block}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={styles.listCard}
          onPress={() => {
            if (item.kind === "prescription_url" && item.url) {
              void Linking.openURL(item.url);
              return;
            }
            if (item.consultationId) {
              navigation.navigate("VetConsultationDetail", {
                farmId,
                farmName,
                consultationId: item.consultationId
              });
            }
          }}
        >
          <Text style={styles.listTitle}>{item.title}</Text>
          <Text style={styles.listMeta}>
            {item.kind === "prescription_url"
              ? t("vet.farmDetail.prescriptionHint")
              : item.kind === "attachment"
                ? t("vet.farmDetail.attachmentHint")
                : t("vet.farmDetail.reportHint")}{" "}
            · {formatDate(item.at)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: mobileSpacing.sm },
  listCard: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.button,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    gap: 2
  },
  listTitle: { fontWeight: "600", color: vetColors.textPrimary },
  listMeta: { ...mobileTypography.meta, color: vetColors.textSecondary },
  empty: { color: vetColors.textSecondary, marginVertical: mobileSpacing.sm }
});
