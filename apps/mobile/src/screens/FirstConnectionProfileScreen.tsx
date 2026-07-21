import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createProfile,
  type ProfileTypeChoice
} from "../lib/api";
import { formatAuthError } from "../lib/authErrors";
import { profileTypeIcon } from "../lib/profileTypeIcon";
import { useSession } from "../context/SessionContext";
import { authColors, authRadii } from "../theme/authTheme";
import { mobileRadius, mobileFontSize } from "../theme/mobileTheme";

const PROFILE_TYPES: ProfileTypeChoice[] = [
  "producer",
  "technician",
  "veterinarian",
  "buyer",
  "merchant"
];

/**
 * Une seule fois par compte : choix du métier avant tout tableau de bord.
 */
export function FirstConnectionProfileScreen() {
  const { t } = useTranslation();
  const { accessToken, setActiveProfileId, signOut } = useSession();
  const [selected, setSelected] = useState<ProfileTypeChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      PROFILE_TYPES.map((type) => ({
        type,
        title: t(`firstConnection.${type}.title`),
        subtitle: t(`firstConnection.${type}.subtitle`)
      })),
    [t]
  );

  const onContinue = async () => {
    if (!selected) {
      setError(t("firstConnection.pickProfile"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await createProfile(accessToken, { type: selected });
      await setActiveProfileId(created.id);
    } catch (e: unknown) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.head}>{t("firstConnection.title")}</Text>

        <View style={styles.body}>
          <Text style={styles.sub}>{t("firstConnection.subtitle")}</Text>

          <View style={styles.cards}>
            {options.map((opt) => {
              const active = selected === opt.type;
              return (
                <TouchableOpacity
                  key={opt.type}
                  style={[styles.card, active && styles.cardActive]}
                  onPress={() => setSelected(opt.type)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt.title}. ${opt.subtitle}`}
                  accessibilityState={{ selected: active }}
                >
                  <View
                    style={[styles.iconWrap, active && styles.iconWrapActive]}
                  >
                    <Ionicons
                      name={profileTypeIcon(opt.type)}
                      size={26}
                      color={active ? authColors.forest : authColors.forestMuted}
                    />
                  </View>
                  <View style={styles.cardText}>
                    <Text
                      style={[styles.cardTitle, active && styles.cardTitleActive]}
                    >
                      {opt.title}
                    </Text>
                    <Text style={styles.cardSub}>{opt.subtitle}</Text>
                  </View>
                  {active ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={authColors.forest}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.cta, (!selected || busy) && styles.ctaDisabled]}
            onPress={() => void onContinue()}
            disabled={!selected || busy}
            activeOpacity={0.88}
          >
            {busy ? (
              <ActivityIndicator color={authColors.forest} />
            ) : (
              <Text style={styles.ctaLabel}>{t("firstConnection.continue")}</Text>
            )}
          </TouchableOpacity>

          {error ? <Text style={styles.err}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.signOutRow}
            onPress={() => void signOut()}
            hitSlop={{ top: 12, bottom: 12 }}
          >
            <Text style={styles.signOutText}>{t("firstConnection.signOut")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: authColors.background
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 32
  },
  head: {
    fontSize: mobileFontSize.xxl,
    fontWeight: "700",
    color: authColors.forest,
    paddingTop: 8
  },
  body: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 36,
    paddingBottom: 12
  },
  sub: {
    fontSize: mobileFontSize.md,
    lineHeight: 22,
    color: authColors.body,
    marginBottom: 22
  },
  cards: {
    gap: 12
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: authRadii.input,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: authColors.background
  },
  cardActive: {
    borderColor: authColors.forest,
    backgroundColor: authColors.cardActiveBg
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: mobileRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: authColors.iconWrapBg
  },
  iconWrapActive: {
    backgroundColor: authColors.iconWrapActiveBg
  },
  cardText: {
    flex: 1,
    minWidth: 0
  },
  cardTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: authColors.forest,
    marginBottom: 4
  },
  cardTitleActive: {
    color: authColors.forestMuted
  },
  cardSub: {
    fontSize: mobileFontSize.md,
    lineHeight: 20,
    color: authColors.body
  },
  cta: {
    marginTop: 26,
    minHeight: 54,
    borderRadius: authRadii.pill,
    backgroundColor: authColors.lime,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  ctaDisabled: {
    opacity: 0.45
  },
  ctaLabel: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: authColors.forest
  },
  err: {
    marginTop: 14,
    color: authColors.error,
    fontSize: mobileFontSize.md,
    textAlign: "center"
  },
  signOutRow: {
    marginTop: 28,
    alignSelf: "center",
    paddingVertical: 8
  },
  signOutText: {
    fontSize: mobileFontSize.md,
    color: authColors.placeholder,
    textDecorationLine: "underline"
  }
});
