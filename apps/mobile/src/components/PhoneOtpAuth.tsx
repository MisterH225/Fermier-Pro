import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { getSupabase } from "../lib/supabase";

const RESEND_COOLDOWN_SEC = 60;

type Step = "phone" | "otp";

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
      setError(err instanceof Error ? err.message : String(err));
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.label}>Connexion par téléphone (SMS)</Text>
      {step === "phone" ? (
        <>
          <TextInput
            style={styles.inputPhone}
            placeholder="+2250707070707"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            value={phone}
            onChangeText={setPhone}
            editable={!busy}
          />
          <TouchableOpacity
            style={[styles.btn, busy && styles.btnDis]}
            onPress={() => void sendCode()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnTxt}>Recevoir le code</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.small}>Numéro : {phone}</Text>
          <TextInput
            style={[styles.inputPhone, styles.inputOtp]}
            placeholder="Code SMS"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={8}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            value={otp}
            onChangeText={setOtp}
            editable={!busy}
          />
          <TouchableOpacity
            style={[styles.btn, busy && styles.btnDis]}
            onPress={() => void verifyCode()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnTxt}>Vérifier et se connecter</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnOutline, (busy || resendIn > 0) && styles.btnDis]}
            onPress={() => void sendCode()}
            disabled={busy || resendIn > 0}
          >
            <Text style={styles.btnOutlineTxt}>
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
            style={styles.link}
            disabled={busy}
          >
            <Text style={styles.linkTxt}>Changer de numéro</Text>
          </TouchableOpacity>
        </>
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {info ? <Text style={styles.inf}>{info}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 10
  },
  label: {
    fontSize: 14,
    color: "#4b513d",
    marginBottom: 8,
    fontWeight: "600"
  },
  inputPhone: {
    borderWidth: 1,
    borderColor: "#c5c9b8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#1f2910"
  },
  inputOtp: {
    fontSize: 22,
    letterSpacing: 8,
    textAlign: "center"
  },
  small: {
    fontSize: 13,
    color: "#6d745b",
    marginBottom: 8
  },
  btn: {
    marginTop: 12,
    backgroundColor: "#5d7a1f",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center"
  },
  btnOutline: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#5d7a1f",
    backgroundColor: "#fff"
  },
  btnOutlineTxt: {
    color: "#5d7a1f",
    fontWeight: "600",
    fontSize: 15
  },
  btnDis: {
    opacity: 0.55
  },
  btnTxt: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15
  },
  link: {
    marginTop: 12,
    alignItems: "center"
  },
  linkTxt: {
    color: "#5d7a1f",
    fontSize: 14,
    fontWeight: "600"
  },
  err: {
    marginTop: 10,
    color: "#b00020",
    fontSize: 13
  },
  inf: {
    marginTop: 10,
    color: "#2e5a2e",
    fontSize: 13
  }
});
