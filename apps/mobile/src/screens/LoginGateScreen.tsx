import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GoogleOAuthButton } from "../components/GoogleOAuthButton";
import { PhoneOtpAuth } from "../components/PhoneOtpAuth";
import { isAuthEnvConfigured } from "../env";
import { authColors, authRadii } from "../theme/authTheme";

const LOGO = require("../../assets/images/fermier-pro-logo-nobg.png");

export type LoginGateScreenProps = {
  /** Voir `isDemoNavigationOffered()` : `__DEV__` ou `EXPO_PUBLIC_AUTH_BYPASS`. */
  bypassAllowed?: boolean;
  /**
   * Lance la navigation principale sans session Supabase (données démo factices),
   * sauf si `getDevBypassApiAccessToken()` renvoie un JWT en Metro — alors API réelle.
   */
  onEnterDemoBypass?: () => void;
};

/**
 * Écran avant session : logo, accès démo optionnel, Google, OTP SMS.
 */
export function LoginGateScreen({
  bypassAllowed = false,
  onEnterDemoBypass
}: LoginGateScreenProps) {
  const authOk = isAuthEnvConfigured();
  /** OTP masqué par défaut quand le mode démo est proposé (dev / AUTH_BYPASS). */
  const [showSmsLogin, setShowSmsLogin] = useState(false);
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

          {bypassAllowed && onEnterDemoBypass ? (
            <View style={styles.bypassBlock}>
              <TouchableOpacity
                style={styles.bypassBtn}
                onPress={onEnterDemoBypass}
                activeOpacity={0.88}
              >
                <Ionicons
                  name="flask-outline"
                  size={22}
                  color={authColors.forest}
                  style={styles.bypassBtnIcon}
                />
                <Text style={styles.bypassBtnText}>
                  Explorer l’app — mode démo
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!authOk ? (
            bypassAllowed ? (
              <View style={styles.infoCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={22}
                  color={authColors.forestMuted}
                  style={styles.warnIcon}
                />
                <Text style={styles.infoCardText}>
                  La connexion Google et par SMS ne sont pas disponibles pour le
                  moment. Tu peux utiliser le mode démo ci-dessus.
                </Text>
              </View>
            ) : (
              <View style={styles.warnCard}>
                <Ionicons
                  name="warning-outline"
                  size={22}
                  color={authColors.error}
                  style={styles.warnIcon}
                />
                <Text style={styles.warnText}>
                  La connexion n’est pas encore configurée sur cet appareil.
                </Text>
              </View>
            )
          ) : null}

          {authOk ? (
            <>
              <GoogleOAuthButton />
              {(!bypassAllowed || showSmsLogin) ? (
                <View style={styles.authOrRow}>
                  <View style={styles.authOrLine} />
                  <Text style={styles.authOrText}>ou</Text>
                  <View style={styles.authOrLine} />
                </View>
              ) : null}
            </>
          ) : null}

          {authOk && bypassAllowed && showSmsLogin ? (
            <TouchableOpacity
              style={styles.smsFold}
              onPress={() => setShowSmsLogin(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.smsFoldText}>Masquer la connexion SMS</Text>
            </TouchableOpacity>
          ) : null}

          {authOk && (!bypassAllowed || showSmsLogin) ? <PhoneOtpAuth /> : null}

          {authOk && bypassAllowed && !showSmsLogin ? (
            <>
              <View style={styles.authOrRow}>
                <View style={styles.authOrLine} />
                <Text style={styles.authOrText}>ou</Text>
                <View style={styles.authOrLine} />
              </View>
              <TouchableOpacity
                style={styles.smsReveal}
                onPress={() => setShowSmsLogin(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.smsRevealText}>
                  Connexion par SMS (numéro mobile)…
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
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
    marginTop: 8
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
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDF4",
    borderRadius: authRadii.input,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 16,
    marginTop: 16
  },
  infoCardText: {
    flex: 1,
    fontSize: 14,
    color: authColors.body,
    lineHeight: 20
  },
  smsReveal: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 8
  },
  smsRevealText: {
    fontSize: 15,
    fontWeight: "600",
    color: authColors.forest
  },
  smsFold: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 6
  },
  smsFoldText: {
    fontSize: 14,
    color: authColors.placeholder,
    fontWeight: "500"
  },
  bypassBlock: {
    marginTop: 16,
    width: "100%"
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
  bypassBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: authColors.lime,
    borderRadius: authRadii.pill,
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 56
  },
  bypassBtnIcon: {
    marginRight: 10
  },
  bypassBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: authColors.forest
  }
});
