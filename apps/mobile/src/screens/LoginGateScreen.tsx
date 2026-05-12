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
import { PhoneOtpAuth } from "../components/PhoneOtpAuth";
import { getExpoPublicEnv, isApiUrlConfigured, isAuthEnvConfigured } from "../env";
import { authColors, authRadii } from "../theme/authTheme";

const LOGO = require("../../assets/images/fermier-pro-logo.png");

function supabaseHostLabel(): string {
  const raw = getExpoPublicEnv().supabaseUrl.trim();
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw).host;
  } catch {
    return "(URL invalide)";
  }
}

export type LoginGateScreenProps = {
  /** Voir `isDemoNavigationOffered()` : `__DEV__` ou `EXPO_PUBLIC_AUTH_BYPASS`. */
  bypassAllowed?: boolean;
  /** Lance la navigation principale sans session Supabase (données démo). */
  onEnterDemoBypass?: () => void;
};

/**
 * Écran avant session : logo, charte maquette, configuration .env + OTP téléphone.
 */
export function LoginGateScreen({
  bypassAllowed = false,
  onEnterDemoBypass
}: LoginGateScreenProps) {
  const authOk = isAuthEnvConfigured();
  const [showDiag, setShowDiag] = useState(false);
  /** OTP masqué par défaut quand le mode démo est proposé (dev / AUTH_BYPASS). */
  const [showSmsLogin, setShowSmsLogin] = useState(false);
  const { width: winW } = useWindowDimensions();
  const logoW = Math.min(winW - 32, 560);
  const logoH = Math.round(logoW * 0.52);

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
            <Text style={styles.tagline}>LA FERME INTÉGRÉE</Text>
            <Text style={styles.lead}>
              Pilote tes fermes, ton cheptel et tes opérations au quotidien.
            </Text>
          </View>

          {bypassAllowed && onEnterDemoBypass ? (
            <View style={styles.bypassBlock}>
              <Text style={styles.bypassHint}>
                Parcours les écrans sans compte (données démo côté profil ; API
                réelle si EXPO_PUBLIC_API_URL est joignable).
              </Text>
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
                  Supabase non configuré : la connexion par SMS sera disponible
                  après copie de .env.example vers .env et renseignement des
                  clés. En attendant, utilise le bouton ci-dessus.
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
                  Copiez apps/mobile/.env.example vers .env et renseignez
                  EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY.
                </Text>
              </View>
            )
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
            <TouchableOpacity
              style={styles.smsReveal}
              onPress={() => setShowSmsLogin(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.smsRevealText}>
                Connexion par SMS (Supabase)…
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.diagToggle}
            onPress={() => setShowDiag((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.diagToggleText}>
              {showDiag ? "Masquer la configuration" : "Configuration API"}
            </Text>
            <Ionicons
              name={showDiag ? "chevron-up" : "chevron-down"}
              size={18}
              color={authColors.placeholder}
              style={styles.diagChevron}
            />
          </TouchableOpacity>

          {showDiag ? (
            <View style={styles.diagBox}>
              <Text style={styles.okInline} selectable>
                Supabase (hôte) : {supabaseHostLabel() || "—"}
              </Text>
              {!isApiUrlConfigured() ? (
                <Text style={[styles.warnInline, styles.diagSecond]}>
                  Ajoutez EXPO_PUBLIC_API_URL pour charger vos fermes (ex.
                  http://10.0.2.2:3000 sur émulateur Android, IP LAN sur
                  téléphone).
                </Text>
              ) : (
                <Text style={[styles.okInline, styles.diagSecond]} selectable>
                  API : {process.env.EXPO_PUBLIC_API_URL}
                </Text>
              )}
            </View>
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
    paddingTop: 12,
    paddingBottom: 40
  },
  logoBlock: {
    alignItems: "center",
    marginBottom: 8
  },
  logo: {
    marginBottom: 12,
    alignSelf: "center"
  },
  diagSecond: {
    marginTop: 10
  },
  tagline: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 3.2,
    color: authColors.body,
    marginBottom: 8
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
  bypassHint: {
    fontSize: 12,
    color: authColors.placeholder,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 12
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
  },
  diagToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28
  },
  diagToggleText: {
    fontSize: 14,
    color: authColors.placeholder,
    fontWeight: "500"
  },
  diagChevron: {
    marginLeft: 6
  },
  diagBox: {
    marginTop: 12,
    paddingHorizontal: 4
  },
  warnInline: {
    fontSize: 13,
    color: authColors.body,
    lineHeight: 19,
    textAlign: "center"
  },
  okInline: {
    fontSize: 13,
    color: authColors.forestMuted,
    textAlign: "center"
  }
});
