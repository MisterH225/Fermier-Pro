import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { PhoneInput } from "../components/PhoneInput";
import { useSession } from "../context/SessionContext";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { useScrollBottomPad } from "../hooks/useScrollBottomPad";
import { checkPhoneAvailability } from "../lib/api";
import { formatAuthError } from "../lib/authErrors";
import { getSupabase } from "../lib/supabase";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "AddPhone">;
type Step = "phone" | "otp";

const RESEND_COOLDOWN_SEC = 60;
const MAX_VERIFY_ATTEMPTS = 3;

function isPlausibleE164(full: string): boolean {
  const digits = full.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function mapAddPhoneError(err: unknown, t: (key: string) => string): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const m = raw.toLowerCase();

  if (
    m.includes("déjà utilisé") ||
    m.includes("already") ||
    m.includes("phone_exists") ||
    m.includes("phone exists") ||
    m.includes("already registered") ||
    m.includes("already been registered")
  ) {
    return t("addPhone.phoneTaken");
  }
  if (m.includes("déjà associé") || m.includes("already associated")) {
    return t("addPhone.alreadyHasPhone");
  }
  if (m.includes("invalide") || m.includes("invalid phone")) {
    return t("addPhone.invalidPhone");
  }
  if (m.includes("expired")) {
    return t("addPhone.otpExpired");
  }
  if (m.includes("otp") || m.includes("token") || m.includes("code")) {
    if (m.includes("invalid") || m.includes("incorrect") || m.includes("wrong")) {
      return t("addPhone.invalidOtp");
    }
  }
  if (
    m.includes("sms") ||
    m.includes("hook") ||
    m.includes("yellika") ||
    m.includes("unavailable")
  ) {
    return t("addPhone.smsFailed");
  }

  return formatAuthError(err);
}

export function AddPhoneScreen({ navigation }: Props) {
  const { t } = useTranslation();
  useScreenTitle(navigation, t("addPhone.title"));
  const scrollPad = useScrollBottomPad();
  const { accessToken, reloadAuth } = useSession();
  const supabase = getSupabase();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [verifyAttempts, setVerifyAttempts] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const sendCode = async () => {
    setError(null);
    if (!accessToken || !supabase) {
      setError(t("addPhone.smsFailed"));
      return;
    }
    const p = phone.trim();
    if (!isPlausibleE164(p)) {
      setError(t("addPhone.invalidPhone"));
      return;
    }

    setBusy(true);
    try {
      const checked = await checkPhoneAvailability(accessToken, p);
      const { error: e } = await supabase.auth.updateUser({
        phone: checked.phone
      });
      if (e) throw e;
      setPhone(checked.phone);
      setStep("otp");
      setOtp("");
      setVerifyAttempts(0);
      setResendIn(RESEND_COOLDOWN_SEC);
    } catch (err: unknown) {
      setError(mapAddPhoneError(err, t));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    if (!supabase) {
      setError(t("addPhone.smsFailed"));
      return;
    }
    if (verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
      setError(t("addPhone.maxAttempts"));
      return;
    }
    const code = otp.trim();
    if (code.length < 4) {
      setError(t("addPhone.invalidOtp"));
      return;
    }

    setBusy(true);
    try {
      const { error: e } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: code,
        type: "phone_change"
      });
      if (e) throw e;
      await reloadAuth();
      Alert.alert(t("addPhone.success"), undefined, [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (err: unknown) {
      const next = verifyAttempts + 1;
      setVerifyAttempts(next);
      if (next >= MAX_VERIFY_ATTEMPTS) {
        setError(t("addPhone.maxAttempts"));
      } else {
        setError(mapAddPhoneError(err, t));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: scrollPad }]}
      >
        <Text style={styles.hint}>
          {step === "phone" ? t("addPhone.hintPhone") : t("addPhone.hintOtp")}
        </Text>

        {step === "phone" ? (
          <>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              editable={!busy}
              showHint
            />
            <TouchableOpacity
              style={[styles.cta, busy && styles.ctaDisabled]}
              onPress={() => void sendCode()}
              disabled={busy}
              activeOpacity={0.88}
            >
              {busy ? (
                <ActivityIndicator color={mobileColors.onAccent} />
              ) : (
                <Text style={styles.ctaText}>{t("addPhone.receiveCode")}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.phoneRecall}>{phone}</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="••••••"
              placeholderTextColor={mobileColors.textSecondary}
              keyboardType="number-pad"
              maxLength={8}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              value={otp}
              onChangeText={setOtp}
              editable={!busy && verifyAttempts < MAX_VERIFY_ATTEMPTS}
            />
            <TouchableOpacity
              style={[
                styles.cta,
                (busy || verifyAttempts >= MAX_VERIFY_ATTEMPTS) &&
                  styles.ctaDisabled
              ]}
              onPress={() => void verifyCode()}
              disabled={busy || verifyAttempts >= MAX_VERIFY_ATTEMPTS}
              activeOpacity={0.88}
            >
              {busy ? (
                <ActivityIndicator color={mobileColors.onAccent} />
              ) : (
                <Text style={styles.ctaText}>{t("addPhone.verify")}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.outlineBtn,
                (busy || resendIn > 0) && styles.ctaDisabled
              ]}
              onPress={() => void sendCode()}
              disabled={busy || resendIn > 0}
              activeOpacity={0.88}
            >
              <Text style={styles.outlineText}>
                {resendIn > 0
                  ? t("addPhone.resendCooldown", { seconds: resendIn })
                  : t("addPhone.resend")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setStep("phone");
                setOtp("");
                setError(null);
                setResendIn(0);
                setVerifyAttempts(0);
              }}
              style={styles.linkWrap}
              disabled={busy}
            >
              <Text style={styles.link}>{t("addPhone.changeNumber")}</Text>
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={styles.err}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: mobileColors.canvas },
  content: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  hint: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    lineHeight: 22,
    marginBottom: mobileSpacing.sm
  },
  phoneRecall: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    textAlign: "center",
    marginBottom: mobileSpacing.sm
  },
  otpInput: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.background,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    fontSize: mobileFontSize.xl,
    letterSpacing: 6,
    textAlign: "center",
    color: mobileColors.textPrimary,
    minHeight: 56
  },
  cta: {
    marginTop: mobileSpacing.sm,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: mobileSpacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: {
    color: mobileColors.onAccent,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingVertical: mobileSpacing.md,
    alignItems: "center",
    backgroundColor: mobileColors.background,
    minHeight: 52,
    justifyContent: "center"
  },
  outlineText: {
    color: mobileColors.textPrimary,
    fontSize: mobileFontSize.lg,
    fontWeight: "600"
  },
  linkWrap: {
    marginTop: mobileSpacing.sm,
    alignItems: "center"
  },
  link: {
    color: mobileColors.accent,
    fontSize: mobileFontSize.md,
    fontWeight: "700"
  },
  err: {
    marginTop: mobileSpacing.sm,
    color: mobileColors.error,
    fontSize: mobileFontSize.md,
    lineHeight: 20
  }
});
