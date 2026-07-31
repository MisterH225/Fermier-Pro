import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FeedCompositionCardPayload } from "../../lib/feedCompositionChatMessage";
import {
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

export function CompositionCardInChat({
  payload,
  isMine,
  onApply,
  messageId,
  showApply
}: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
        {!payload.feasible ? " · non faisable" : ""}
      </Text>
      {payload.ration.slice(0, 4).map((l) => (
        <Text key={l.feedIngredientId} style={styles.line}>
          {rationLineName(l)} · {formatPct(l.proportionPct)}
        </Text>
      ))}
      {payload.ration.length > 4 ? (
        <Text style={styles.meta}>+{payload.ration.length - 4} autres…</Text>
      ) : null}
      {payload.note?.trim() ? (
        <Text style={styles.note}>« {payload.note.trim()} »</Text>
      ) : null}
      {payload.nutritionDelta && payload.variant === "adjustment" ? (
        <Text style={styles.delta}>
          Énergie du mélange :{" "}
          {payload.nutritionDelta.energyChangePct != null
            ? `${Number(payload.nutritionDelta.energyChangePct).toFixed(1)} %`
            : "—"}
        </Text>
      ) : null}

      <Pressable
        onPress={() =>
          navigation.navigate("FeedCompositionDetail", {
            farmId: payload.farmId,
            farmName: "",
            compositionId: payload.compositionId
          })
        }
      >
        <Text style={styles.link}>Voir le détail →</Text>
      </Pressable>

      {showApply &&
      payload.variant === "adjustment" &&
      payload.feasible &&
      messageId &&
      onApply ? (
        <Pressable
          style={styles.applyBtn}
          testID="apply-adjustment-in-chat"
          onPress={() => onApply(messageId, payload)}
        >
          <Text style={styles.applyLabel}>Appliquer cette version</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: "88%",
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
  line: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    fontWeight: "600"
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
  }
});
