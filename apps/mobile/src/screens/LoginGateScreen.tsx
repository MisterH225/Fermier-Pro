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
              accessibilityLabel="Fermier Pro"
            />
            <Text style={styles.lead}>
              Pilote tes fermes, ton cheptel et tes opérations au quotidien.
            </Text>
          </View>

          {!authOk ? (
            <View style={styles.warnCard}>
              <Ionicons
                name="warning-outline"
                size={22}
                color={authColors.error}
                style={styles.warnIcon}
              />
              <Text style={styles.warnText}>
                Configure EXPO_PUBLIC_SUPABASE_URL et
                EXPO_PUBLIC_SUPABASE_ANON_KEY dans apps/mobile/.env avec l’URL
                réelle du projet Supabase (pas le modèle avec &lt;project-ref&gt;),
                puis redémarre Expo avec --clear.
              </Text>
            </View>
          ) : (
            <>
              {showDevRedirectHint ? (
                <View style={styles.redirectHint}>
                  <Text style={styles.redirectHintTitle}>
                    URL de redirection (Supabase)
                  </Text>
                  <Text style={styles.redirectHintUrl} selectable>
                    {oauthRedirectUri}
                  </Text>
                  <Text style={styles.redirectHintBody}>
                    Supabase → Authentication → URL configuration :{"\n"}
                    1. Site URL = l’URL exp://… ci-dessus (pas localhost).{"\n"}
                    2. Redirect URLs = la même URL (bouton +).{"\n"}
                    Google : Providers → Google (Client ID / Secret).
                  </Text>
                  {oauthRedirectUri.includes("localhost") ? (
                    <Text style={styles.redirectWarn}>
                      Cette URL contient localhost : sur iPhone ça échouera.
                      Relance Expo en LAN (même Wi‑Fi) et rescanne le QR code.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <GoogleOAuthButton />

              <View style={styles.authOrRow}>
                <View style={styles.authOrLine} />
                <Text style={styles.authOrText}>ou</Text>
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
    backgroundColor: "#FEF2F2",
    borderRadius: authRadii.input,
    borderWidth: 1,
    borderColor: "#FECACA",
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
    backgroundColor: "#F8FAFC"
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
