import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatAuthError } from "../lib/authErrors";
import {
  buildE164Phone,
  defaultDialCountry,
  PHONE_DIAL_COUNTRIES,
  type DialCountry
} from "../lib/phoneDialCountries";
import { getSupabase } from "../lib/supabase";
import { authColors, authRadii } from "../theme/authTheme";

const RESEND_COOLDOWN_SEC = 60;

type Step = "phone" | "otp";

function isPlausibleE164(full: string): boolean {
  const digits = full.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Connexion par SMS OTP (Supabase). Numéro en E.164 : indicatif pays + numéro local.
 */
export function PhoneOtpAuth() {
  const supabase = getSupabase();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("phone");
  const [selectedCountry, setSelectedCountry] = useState<DialCountry>(() =>
    defaultDialCountry()
  );
  const [nationalNumber, setNationalNumber] = useState("");
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countryFilter, setCountryFilter] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const e164Phone = useMemo(
    () => buildE164Phone(selectedCountry.dial, nationalNumber),
    [selectedCountry.dial, nationalNumber]
  );

  const filteredCountries = useMemo(() => {
    const q = countryFilter.trim().toLowerCase();
    if (!q) {
      return PHONE_DIAL_COUNTRIES;
    }
    return PHONE_DIAL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.replace("+", "").includes(q) ||
        c.iso2.toLowerCase().includes(q)
    );
  }, [countryFilter]);

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
    const p = e164Phone.trim();
    if (!isPlausibleE164(p)) {
      setError(
        "Choisis ton pays, puis saisis ton numéro mobile (sans l’indicatif). Vérifie que le numéro complet est correct."
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
    const p = e164Phone.trim();
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

  const displayPhone = `${selectedCountry.flag} ${selectedCountry.dial} ${nationalNumber.trim()}`;

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
          ? "Choisis ton pays, puis saisis ton numéro mobile. Tu recevras un code par SMS."
          : "Entre le code à 6 chiffres reçu par SMS."}
      </Text>

      {step === "phone" ? (
        <>
          <View style={styles.phoneRow}>
            <TouchableOpacity
              style={styles.countryPicker}
              onPress={() => {
                setCountryFilter("");
                setCountryModalOpen(true);
              }}
              disabled={busy}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Pays et indicatif, ${selectedCountry.name} ${selectedCountry.dial}`}
            >
              <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
              <Text style={styles.countryDial}>{selectedCountry.dial}</Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={authColors.forestMuted}
              />
            </TouchableOpacity>
            <View style={styles.nationalShell}>
              <TextInput
                style={styles.nationalInput}
                placeholder="6 12 34 56 78"
                placeholderTextColor={authColors.placeholder}
                keyboardType="phone-pad"
                autoComplete="tel-national"
                textContentType="telephoneNumber"
                value={nationalNumber}
                onChangeText={setNationalNumber}
                editable={!busy}
              />
            </View>
          </View>
          <Text style={styles.phoneHint}>
            Pas besoin de retaper l’indicatif : il est défini par le drapeau.
          </Text>
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
          <Text style={styles.phoneRecall}>{displayPhone}</Text>
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
        Pas encore de compte ? La première connexion (Google ou code SMS) crée ton accès
        Fermier Pro.
      </Text>

      <Modal
        visible={countryModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCountryModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCountryModalOpen(false)}
        >
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pays / indicatif</Text>
              <TouchableOpacity
                onPress={() => setCountryModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={26} color={authColors.forest} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearch}
              placeholder="Rechercher un pays…"
              placeholderTextColor={authColors.placeholder}
              value={countryFilter}
              onChangeText={setCountryFilter}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.iso2}
              keyboardShouldPersistTaps="handled"
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryRow,
                    selectedCountry.iso2 === item.iso2 &&
                      selectedCountry.dial === item.dial &&
                      styles.countryRowOn
                  ]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setCountryModalOpen(false);
                    setCountryFilter("");
                  }}
                >
                  <Text style={styles.countryRowFlag}>{item.flag}</Text>
                  <View style={styles.countryRowText}>
                    <Text style={styles.countryRowName}>{item.name}</Text>
                    <Text style={styles.countryRowDial}>{item.dial}</Text>
                  </View>
                  {selectedCountry.iso2 === item.iso2 &&
                  selectedCountry.dial === item.dial ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={authColors.forest}
                    />
                  ) : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>Aucun pays ne correspond.</Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
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
    marginBottom: 20
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10
  },
  countryPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    minWidth: 108,
    maxWidth: 124,
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: authRadii.input,
    backgroundColor: authColors.background,
    minHeight: 56
  },
  countryFlag: {
    fontSize: 22
  },
  countryDial: {
    fontSize: 16,
    fontWeight: "700",
    color: authColors.forest
  },
  nationalShell: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: authRadii.input,
    backgroundColor: authColors.background,
    paddingHorizontal: 16,
    minHeight: 56
  },
  nationalInput: {
    flex: 1,
    fontSize: 17,
    color: authColors.forest,
    paddingVertical: 14
  },
  phoneHint: {
    marginTop: 10,
    fontSize: 13,
    color: authColors.placeholder,
    lineHeight: 18
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
    fontSize: 15,
    color: authColors.body,
    marginBottom: 12,
    textAlign: "center",
    fontWeight: "600"
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: authColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "78%",
    paddingHorizontal: 16,
    paddingTop: 12
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: authColors.forest
  },
  modalSearch: {
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: authRadii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: authColors.forest,
    marginBottom: 8
  },
  modalList: {
    maxHeight: 420
  },
  modalEmpty: {
    textAlign: "center",
    color: authColors.placeholder,
    padding: 24,
    fontSize: 15
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.border,
    gap: 12
  },
  countryRowOn: {
    backgroundColor: "#F0FDF4"
  },
  countryRowFlag: {
    fontSize: 26
  },
  countryRowText: {
    flex: 1,
    minWidth: 0
  },
  countryRowName: {
    fontSize: 16,
    fontWeight: "600",
    color: authColors.forest
  },
  countryRowDial: {
    fontSize: 14,
    color: authColors.body,
    marginTop: 2
  }
});
