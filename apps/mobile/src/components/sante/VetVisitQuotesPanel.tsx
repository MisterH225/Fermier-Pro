import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { fetchVetVisitQuotes, respondVetVisitQuote } from "../../lib/api";
import { formatFarmMoney } from "../../lib/formatMoney";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
};

export function VetVisitQuotesPanel({
  farmId,
  accessToken,
  activeProfileId
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const quotesQ = useQuery({
    queryKey: ["vetVisitQuotes", farmId, activeProfileId],
    queryFn: () => fetchVetVisitQuotes(accessToken, farmId, activeProfileId)
  });

  const respondMut = useMutation({
    mutationFn: (p: {
      id: string;
      action: "accept" | "refuse";
    }) =>
      respondVetVisitQuote(
        accessToken,
        farmId,
        p.id,
        { action: p.action },
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vetVisitQuotes", farmId] });
    }
  });

  const pending = (quotesQ.data ?? []).filter(
    (q) => q.visitQuoteStatus === "pending_producer"
  );

  if (quotesQ.isPending) {
    return <ActivityIndicator color={mobileColors.accent} />;
  }
  if (pending.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("health.vetQuotes.title")}</Text>
      <Text style={styles.legacy}>{t("health.vetQuotes.legacyNotice")}</Text>
      {pending.map((q) => (
        <View key={q.id} style={styles.card}>
          <Text style={styles.vet}>{q.vetName}</Text>
          <Text style={styles.meta}>
            {new Date(q.scheduledAt).toLocaleDateString()} ·{" "}
            {q.consultationPrice != null
              ? formatFarmMoney(q.consultationPrice, "XOF")
              : "—"}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={styles.accept}
              onPress={() => respondMut.mutate({ id: q.id, action: "accept" })}
            >
              <Text style={styles.acceptTx}>{t("health.vetQuotes.accept")}</Text>
            </Pressable>
            <Pressable
              style={styles.refuse}
              onPress={() => respondMut.mutate({ id: q.id, action: "refuse" })}
            >
              <Text style={styles.refuseTx}>{t("health.vetQuotes.refuse")}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: mobileSpacing.md },
  title: { ...mobileTypography.sectionTitle, marginBottom: mobileSpacing.xs },
  legacy: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  card: {
    backgroundColor: "#EFF6FF",
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: 1,
    borderColor: "#BFDBFE"
  },
  vet: { fontWeight: "700", fontSize: 16 },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginTop: 4 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  accept: {
    flex: 1,
    backgroundColor: mobileColors.accent,
    padding: 10,
    borderRadius: mobileRadius.pill,
    alignItems: "center"
  },
  acceptTx: { color: "#fff", fontWeight: "700" },
  refuse: {
    flex: 1,
    borderWidth: 1,
    borderColor: mobileColors.error,
    padding: 10,
    borderRadius: mobileRadius.pill,
    alignItems: "center"
  },
  refuseTx: { color: mobileColors.error, fontWeight: "700" }
});
