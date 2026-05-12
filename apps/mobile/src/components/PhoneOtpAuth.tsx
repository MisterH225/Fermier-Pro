import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { authColors, authRadii } from "../theme/authTheme";
import { getSupabase } from "../lib/supabase";

const RESEND_COOLDOWN_SEC = 60;

type Step = "phone" | "otp";

function formatAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.toLowerCase();
  if (
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("network error")
  ) {
    return (
      "Impossible de joindre Supabase (réseau ou URL). Vérifie la connexion internet, " +
      "que EXPO_PUBLIC_SUPABASE_URL dans apps/mobile/.env est exactement l’URL du projet " +
      "(https://….supabase.co), puis redémarre Expo après modification du .env. " +
      "Sans SMS en local : ajoute EXPO_PUBLIC_AUTH_BYPASS=true pour le mode démo."
    );
  }
  return raw;
}

/**
 * Connexion par SMS OTP (Supabase). Numéros au format E.164 (ex. +2250707070707).
 */
export function PhoneOtpAuth() {
  const supabase = getSupabase();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const t = setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  if (!supabase) {
    return null;
  }

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    const p = phone.trim().replace(/\s/g, "");
    if (!p.startsWith("+") || p.length < 11) {
      setError(
        "Format international requis (ex. +22670123456), avec indicatif pays."
      );
      return;
    }
    setBusy(true);
    try {
      const { error: e } = await supabase.auth.signInWithOtp({
        phone: p,
        options: { channel: "sms" }
      });
      if (e) {
        throw e;
      }
      setInfo(
        "Code envoyé par SMS (vérifie aussi les courriers indésirables / filtres)."
      );
      setStep("otp");
      setResendIn(RESEND_COOLDOWN_SEC);
    } catch (err: unknown) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    setInfo(null);
    const p = phone.trim().replace(/\s/g, "");
    const code = otp.trim();
    if (code.length < 4) {
      setError("Saisis le code reçu par SMS.");
      return;
    }
    setBusy(true);
    try {
      const { error: e } = await supabase.auth.verifyOtp({
        phone: p,
        token: code,
        type: "sms"
      });
      if (e) {
        throw e;
      }
      setInfo("Connexion réussie…");
    } catch (err: unknown) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.stepRow} accessibilityRole="progressbar">
        <View
          style={[
            styles.stepSeg,
            step === "phone" ? styles.stepSegActive : styles.stepSegDone
          ]}
        />
        <View
          style={[
            styles.stepSeg,
            step === "otp" ? styles.stepSegActive : styles.stepSegIdle
          ]}
        />
      </View>

      <Text style={styles.screenTitle}>Connexion</Text>
      <Text style={styles.screenHint}>
        {step === "phone"
          ? "Saisis ton numéro mobile. Tu recevras un code par SMS."
          : "Entre le code à 6 chiffres reçu par SMS."}
      </Text>

      {step === "phone" ? (
        <>
          <View style={styles.inputShell}>
            <Ionicons
              name="call-outline"
              size={22}
              color={authColors.forestMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="+2250707070707"
              placeholderTextColor={authColors.placeholder}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              value={phone}
              onChangeText={setPhone}
              editable={!busy}
            />
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, busy && styles.btnDisabled]}
            onPress={() => void sendCode()}
            disabled={busy}
            activeOpacity={0.88}
          >
            {busy ? (
              <ActivityIndicator color={authColors.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>Recevoir le code</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.phoneRecall}>{phone}</Text>
          <View style={styles.inputShell}>
            <Ionicons
              name="keypad-outline"
              size={22}
              color={authColors.forestMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, styles.inputOtp]}
              placeholder="Code SMS"
              placeholderTextColor={authColors.placeholder}
              keyboardType="number-pad"
              maxLength={8}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              value={otp}
              onChangeText={setOtp}
              editable={!busy}
            />
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, busy && styles.btnDisabled]}
            onPress={() => void verifyCode()}
            disabled={busy}
            activeOpacity={0.88}
          >
            {busy ? (
              <ActivityIndicator color={authColors.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>Vérifier et se connecter</Text>
            )}
          </TouchableOpacity>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>ou</Text>
            <View style={styles.orLine} />
          </View>

          <TouchableOpacity
            style={[
              styles.btnOutline,
              (busy || resendIn > 0) && styles.btnDisabled
            ]}
            onPress={() => void sendCode()}
            disabled={busy || resendIn > 0}
            activeOpacity={0.88}
          >
            <Text style={styles.btnOutlineText}>
              {resendIn > 0
                ? `Renvoyer le code (${resendIn}s)`
                : "Renvoyer le code"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setStep("phone");
              setOtp("");
              setError(null);
              setInfo(null);
              setResendIn(0);
            }}
            style={styles.linkWrap}
            disabled={busy}
          >
            <Text style={styles.linkStrong}>Changer de numéro</Text>
          </TouchableOpacity>
        </>
      )}

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {info ? <Text style={styles.inf}>{info}</Text> : null}

      <Text style={styles.footerNote}>
        Pas encore de compte ? Le premier code SMS crée ton accès Fermier Pro.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    width: "100%"
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 28
  },
  stepSeg: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    marginHorizontal: 4
  },
  stepSegIdle: {
    backgroundColor: authColors.border
  },
  stepSegActive: {
    backgroundColor: authColors.lime
  },
  stepSegDone: {
    backgroundColor: authColors.brandGreen
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: authColors.forest,
    marginBottom: 10,
    letterSpacing: -0.5
  },
  screenHint: {
    fontSize: 15,
    color: authColors.body,
    lineHeight: 22,
    marginBottom: 24
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: authRadii.input,
    backgroundColor: authColors.background,
    paddingHorizontal: 16,
    minHeight: 56
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: authColors.forest,
    paddingVertical: 14
  },
  inputOtp: {
    fontSize: 22,
    letterSpacing: 6,
    textAlign: "center"
  },
  phoneRecall: {
    fontSize: 14,
    color: authColors.body,
    marginBottom: 12,
    textAlign: "center"
  },
  btnPrimary: {
    marginTop: 18,
    backgroundColor: authColors.forest,
    borderRadius: authRadii.pill,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56
  },
  btnPrimaryText: {
    color: authColors.white,
    fontSize: 17,
    fontWeight: "600"
  },
  btnDisabled: {
    opacity: 0.55
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 22
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: authColors.border
  },
  orText: {
    marginHorizontal: 14,
    fontSize: 14,
    color: authColors.placeholder
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: authRadii.pill,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: authColors.background,
    minHeight: 56,
    justifyContent: "center"
  },
  btnOutlineText: {
    color: authColors.forest,
    fontSize: 16,
    fontWeight: "600"
  },
  linkWrap: {
    marginTop: 20,
    alignItems: "center"
  },
  linkStrong: {
    color: authColors.forest,
    fontSize: 16,
    fontWeight: "700"
  },
  err: {
    marginTop: 16,
    color: authColors.error,
    fontSize: 14,
    lineHeight: 20
  },
  inf: {
    marginTop: 16,
    color: authColors.success,
    fontSize: 14,
    lineHeight: 20
  },
  footerNote: {
    marginTop: 28,
    fontSize: 13,
    color: authColors.placeholder,
    textAlign: "center",
    lineHeight: 19
  }
});
