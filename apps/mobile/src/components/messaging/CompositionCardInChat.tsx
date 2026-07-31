import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FeedCompositionCardPayload } from "../../lib/feedCompositionChatMessage";
import {
  formatKg,
  formatPct,
  formatXof,
  rationLineName,
  stageLabelFr
} from "../../lib/feedCompositionFormat";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  payload: FeedCompositionCardPayload;
  isMine: boolean;
  onApply?: (messageId: string, payload: FeedCompositionCardPayload) => void;
  onReject?: (proposalId: string, payload: FeedCompositionCardPayload) => void;
  messageId?: string;
  showApply?: boolean;
};

function variantLabel(v: FeedCompositionCardPayload["variant"]): string {
  switch (v) {
    case "adjustment":
      return "Nouveau mélange proposé";
    case "validated":
      return "Mélange validé par le véto";
    case "request_changes":
      return "Le véto demande des changements";
    default:
      return "Mélange à faire valider";
  }
}

function needsValidation(v: FeedCompositionCardPayload["variant"]): boolean {
  return v === "initial" || v === "request_changes";
}

export function CompositionCardInChat({
  payload,
  isMine,
  onApply,
  onReject,
  messageId,
  showApply
}: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const ration = Array.isArray(payload.ration) ? payload.ration : [];
  const nutrition = payload.nutritionResult;
  const openDetail = () =>
    navigation.navigate("FeedCompositionDetail", {
      farmId: payload.farmId,
      farmName: "",
      compositionId: payload.compositionId
    });

  const canActOnAdjustment =
    showApply &&
    payload.variant === "adjustment" &&
    payload.feasible &&
    !isMine;

  return (
    <View
      style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapOther]}
      testID="composition-chat-card"
    >
      <Text style={styles.badge}>{variantLabel(payload.variant)}</Text>
      <Text style={styles.title}>{stageLabelFr(payload.stage)}</Text>
      <Text style={styles.cost}>{formatXof(payload.totalCostXof)}</Text>
      <Text style={styles.meta}>
        {formatXof(payload.costPerKg)} / kg
        {payload.totalFeedKg > 0
          ? ` · ${formatKg(payload.totalFeedKg)} au total`
          : ""}
        {!payload.feasible ? " · non faisable" : ""}
      </Text>

      {ration.length === 0 ? (
        <Text style={styles.emptyRation} testID="composition-card-empty-ration">
          Détail des intrants indisponible dans cette carte — ouvrez le détail.
        </Text>
      ) : (
        <View style={styles.rationBlock} testID="composition-card-ration">
          {ration.slice(0, 8).map((l) => (
            <Text key={l.feedIngredientId} style={styles.line}>
              {rationLineName(l)} · {formatPct(l.proportionPct)}
              {l.quantityKg > 0 ? ` · ${formatKg(l.quantityKg)}` : ""}
            </Text>
          ))}
          {ration.length > 8 ? (
            <Text style={styles.meta}>+{ration.length - 8} autres…</Text>
          ) : null}
        </View>
      )}

      {nutrition ? (
        <Text style={styles.nutrition} testID="composition-card-nutrition">
          Énergie {Math.round(nutrition.metabolizableEnergyKcal)} kcal/kg ·
          Protéines {formatPct(nutrition.crudeProteinPct)}
        </Text>
      ) : null}

      {payload.note?.trim() ? (
        <Text style={styles.note}>« {payload.note.trim()} »</Text>
      ) : null}
      {payload.nutritionDelta && payload.variant === "adjustment" ? (
        <Text style={styles.delta}>
          Écart énergie :{" "}
          {payload.nutritionDelta.energyChangePct != null
            ? `${Number(payload.nutritionDelta.energyChangePct).toFixed(1)} %`
            : "—"}
          {payload.nutritionDelta.crudeProteinPct != null
            ? ` · protéines ${Number(payload.nutritionDelta.crudeProteinPct) >= 0 ? "+" : ""}${Number(payload.nutritionDelta.crudeProteinPct).toFixed(2)} pts`
            : ""}
        </Text>
      ) : null}
      {payload.fatRiskAlert ? (
        <Text style={styles.fatRisk} testID="composition-card-fat-risk">
          Risque de gras : l’énergie dépasse le plafond de ce stade.
        </Text>
      ) : null}

      {needsValidation(payload.variant) && !isMine ? (
        <Pressable
          style={styles.primaryBtn}
          testID="composition-card-open-validate"
          onPress={openDetail}
        >
          <Text style={styles.primaryBtnLabel}>Ouvrir pour valider</Text>
        </Pressable>
      ) : (
        <Pressable onPress={openDetail} testID="composition-card-open-detail">
          <Text style={styles.link}>Voir le détail de la ration →</Text>
        </Pressable>
      )}

      {canActOnAdjustment && messageId && onApply ? (
        <Pressable
          style={styles.applyBtn}
          testID="apply-adjustment-in-chat"
          onPress={() => onApply(messageId, payload)}
        >
          <Text style={styles.applyLabel}>Appliquer cette version</Text>
        </Pressable>
      ) : null}
      {canActOnAdjustment && payload.proposalId && onReject ? (
        <Pressable
          style={styles.rejectBtn}
          testID="reject-adjustment-in-chat"
          onPress={() => onReject(payload.proposalId!, payload)}
        >
          <Text style={styles.rejectLabel}>Refuser</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: "92%",
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    gap: 4
  },
  wrapMine: {
    alignSelf: "flex-end",
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  wrapOther: {
    alignSelf: "flex-start",
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  badge: {
    fontSize: mobileFontSize.xs,
    fontWeight: "800",
    color: mobileColors.accent,
    textTransform: "uppercase"
  },
  title: {
    fontSize: mobileFontSize.md,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  cost: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  meta: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary
  },
  rationBlock: {
    marginTop: 4,
    gap: 2
  },
  line: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  emptyRation: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    fontStyle: "italic",
    marginTop: 4
  },
  nutrition: {
    marginTop: 4,
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: mobileStatusSurfaces.successText
  },
  note: {
    fontSize: mobileFontSize.sm,
    fontStyle: "italic",
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  delta: {
    fontSize: mobileFontSize.sm,
    color: mobileStatusSurfaces.infoText,
    fontWeight: "700"
  },
  link: {
    marginTop: 6,
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: 12,
    alignItems: "center"
  },
  primaryBtnLabel: {
    color: mobileColors.onAccent,
    fontWeight: "800",
    fontSize: mobileFontSize.sm
  },
  applyBtn: {
    marginTop: 8,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: 10,
    alignItems: "center"
  },
  applyLabel: {
    color: mobileColors.onAccent,
    fontWeight: "800"
  },
  rejectBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingVertical: 10,
    alignItems: "center"
  },
  rejectLabel: {
    color: mobileColors.textPrimary,
    fontWeight: "700"
  },
  fatRisk: {
    marginTop: 4,
    color: "#B45309",
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  }
});
