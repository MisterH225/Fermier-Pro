import { Pressable, StyleSheet, Text, View } from "react-native";
import { mobileRadius, mobileSpacing, mobileTypography, mobileStatusSurfaces, mobileFontSize } from "../../theme/mobileTheme";
import type { FeedUserStatus } from "../../lib/api/community-feed";
import { producerColors } from "../../theme/producerTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  feedStatus: FeedUserStatus;
  suspensionUntil: string | null;
  onAppeal?: () => void;
};

export function SuspensionBanner({ feedStatus, suspensionUntil, onAppeal }: Props) {
  if (feedStatus === "active" || feedStatus === "warned_1" || feedStatus === "warned_2") {
    return null;
  }

  const untilLabel = suspensionUntil
    ? new Date(suspensionUntil).toLocaleDateString("fr-FR")
    : null;

  const message =
    feedStatus === "banned_permanent"
      ? "Votre accès au Feed a été définitivement suspendu suite à des violations répétées des règles de la communauté."
      : `Votre accès au Feed est suspendu${untilLabel ? ` jusqu'au ${untilLabel}` : ""}. Vous pouvez consulter les publications mais pas en créer.`;

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Accès Feed restreint</Text>
      <Text style={styles.body}>{message}</Text>
      {onAppeal ? (
        <Pressable onPress={onAppeal} style={styles.appealBtn}>
          <Text style={styles.appealTx}>Contester cette décision</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: mobileStatusSurfaces.errorBg,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md,
    borderWidth: 1,
    borderColor: uiNamedColors.cFECACA
  },
  title: {
    ...mobileTypography.cardTitle,
    color: producerColors.dangerStrong,
    marginBottom: 4
  },
  body: {
    ...mobileTypography.body,
    color: uiNamedColors.c7F1D1D,
    fontSize: mobileFontSize.sm
  },
  appealBtn: {
    marginTop: mobileSpacing.sm,
    alignSelf: "flex-start"
  },
  appealTx: {
    ...mobileTypography.meta,
    color: producerColors.dangerStrong,
    fontWeight: "600",
    textDecorationLine: "underline"
  }
});
