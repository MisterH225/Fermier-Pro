import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GoogleOAuthButton } from "../components/GoogleOAuthButton";
import { PhoneOtpAuth } from "../components/PhoneOtpAuth";
import { isAuthEnvConfigured } from "../env";
import { getGoogleOAuthRedirectUri } from "../lib/googleAuth";
import { authColors, authRadii } from "../theme/authTheme";

const LOGO = require("../../assets/images/fermier-pro-logo-nobg.png");

/**
 * Écran de connexion : Google OAuth ou SMS (Supabase Auth).
 */
export function LoginGateScreen() {
  const { t } = useTranslation();
  const authOk = isAuthEnvConfigured();
  const oauthRedirectUri = authOk ? getGoogleOAuthRedirectUri() : "";
  const showDevRedirectHint =
    typeof __DEV__ !== "undefined" && __DEV__ && authOk;
  const { width: winW } = useWindowDimensions();
  const logoW = Math.min(winW - 80, 340);
  const logoH = Math.round(logoW * (295 / 601));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoBlock}>
            <Image
              source={LOGO}
              style={[styles.logo, { width: logoW, height: logoH }]}
              resizeMode="contain"
              accessibilityLabel={t("loginGate.logoA11y")}
            />
            <Text style={styles.lead}>{t("loginGate.lead")}</Text>
          </View>

          {!authOk ? (
            <View style={styles.warnCard}>
              <Ionicons
                name="warning-outline"
                size={22}
                color={authColors.error}
                style={styles.warnIcon}
              />
              <Text style={styles.warnText}>{t("loginGate.envWarn")}</Text>
            </View>
          ) : (
            <>
              {showDevRedirectHint ? (
                <View style={styles.redirectHint}>
                  <Text style={styles.redirectHintTitle}>
                    {t("loginGate.redirectTitle")}
                  </Text>
                  <Text style={styles.redirectHintUrl} selectable>
                    {oauthRedirectUri}
                  </Text>
                  <Text style={styles.redirectHintBody}>
                    {t("loginGate.redirectBody")}
                  </Text>
                  {oauthRedirectUri.includes("localhost") ? (
                    <Text style={styles.redirectWarn}>
                      {t("loginGate.redirectLocalhostWarn")}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <GoogleOAuthButton />

              <View style={styles.authOrRow}>
                <View style={styles.authOrLine} />
                <Text style={styles.authOrText}>{t("loginGate.or")}</Text>
                <View style={styles.authOrLine} />
              </View>

              <PhoneOtpAuth />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: authColors.background
  },
  flex: {
    flex: 1
  },
  scroll: {
    flex: 1
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40
  },
  logoBlock: {
    alignItems: "center",
    marginBottom: 4,
    gap: 2
  },
  logo: {
    marginBottom: 0,
    alignSelf: "center"
  },
  lead: {
    fontSize: 15,
    color: authColors.body,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: 8
  },
  warnCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: authColors.warnSurface,
    borderRadius: authRadii.input,
    borderWidth: 1,
    borderColor: authColors.warnBorder,
    padding: 16,
    marginTop: 16
  },
  warnIcon: {
    marginRight: 10,
    marginTop: 2
  },
  warnText: {
    flex: 1,
    fontSize: 14,
    color: authColors.error,
    lineHeight: 20
  },
  authOrRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 4
  },
  authOrLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: authColors.border
  },
  authOrText: {
    marginHorizontal: 14,
    fontSize: 14,
    color: authColors.placeholder
  },
  redirectHint: {
    marginTop: 16,
    marginBottom: 4,
    padding: 14,
    borderRadius: authRadii.input,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.surfaceSubtle
  },
  redirectHintTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: authColors.forestMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 6
  },
  redirectHintUrl: {
    fontSize: 13,
    color: authColors.forest,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 8
  },
  redirectHintBody: {
    fontSize: 12,
    lineHeight: 17,
    color: authColors.body
  },
  redirectWarn: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: authColors.error,
    fontWeight: "600"
  }
});
