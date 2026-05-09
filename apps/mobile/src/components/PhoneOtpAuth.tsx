import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { getSupabase } from "../lib/supabase";

type Step = "phone" | "otp";

/**
 * Connexion par SMS OTP (Supabase). Numeros au format E.164 (ex. +2250707070707).
 */
export function PhoneOtpAuth() {
  const supabase = getSupabase();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
      setInfo("Code envoye par SMS (verifie aussi les filtres anti-spam).");
      setStep("otp");
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
      setError("Saisis le code recu par SMS.");
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.label}>Connexion par telephone (SMS)</Text>
      {step === "phone" ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="+2250707070707"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            autoComplete="tel"
            value={phone}
            onChangeText={setPhone}
            editable={!busy}
          />
          <TouchableOpacity
            style={[styles.btn, busy && styles.btnDis]}
            onPress={sendCode}
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
          <Text style={styles.small}>Numero : {phone}</Text>
          <TextInput
            style={styles.input}
            placeholder="Code SMS"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={10}
            value={otp}
            onChangeText={setOtp}
            editable={!busy}
          />
          <TouchableOpacity
            style={[styles.btn, busy && styles.btnDis]}
            onPress={verifyCode}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnTxt}>Verifier et se connecter</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setStep("phone");
              setOtp("");
              setError(null);
              setInfo(null);
            }}
            style={styles.link}
            disabled={busy}
          >
            <Text style={styles.linkTxt}>Changer de numero</Text>
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
  input: {
    borderWidth: 1,
    borderColor: "#c5c9b8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#1f2910"
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
  btnDis: {
    opacity: 0.7
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
