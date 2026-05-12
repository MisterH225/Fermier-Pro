import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { formatAuthError } from "../lib/authErrors";
import { getGoogleOAuthRedirectUri, signInWithGoogle } from "../lib/googleAuth";
import { authColors, authRadii } from "../theme/authTheme";

/**
 * Connexion via Google (Supabase Auth). Compléter la config côté dashboard Supabase
 * (Provider Google + Redirect URLs incluant l’URL renvoyée par `getGoogleOAuthRedirectUri()` en dev/build).
 */
export function GoogleOAuthButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRedirectHint, setShowRedirectHint] = useState(false);

  const onPress = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={() => void onPress()}
        disabled={busy}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Continuer avec Google"
      >
        {busy ? (
          <ActivityIndicator color={authColors.forest} />
        ) : (
          <>
            <Ionicons
              name="logo-google"
              size={22}
              color={authColors.forest}
              style={styles.icon}
            />
            <Text style={styles.label}>Continuer avec Google</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setShowRedirectHint((v) => !v)}
        style={styles.hintToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.hintToggleText}>
          {showRedirectHint ? "Masquer l’URL de redirection" : "URL de redirection (Supabase)"}
        </Text>
      </TouchableOpacity>
      {showRedirectHint ? (
        <Text style={styles.monoHint} selectable>
          {getGoogleOAuthRedirectUri()}
        </Text>
      ) : null}

      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginTop: 4
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: authRadii.pill,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.background
  },
  btnDisabled: {
    opacity: 0.55
  },
  icon: {
    marginRight: 10
  },
  label: {
    fontSize: 17,
    fontWeight: "600",
    color: authColors.forest
  },
  hintToggle: {
    marginTop: 10,
    alignSelf: "center"
  },
  hintToggleText: {
    fontSize: 13,
    color: authColors.placeholder,
    textDecorationLine: "underline"
  },
  monoHint: {
    marginTop: 8,
    fontSize: 11,
    color: authColors.forestMuted,
    textAlign: "center",
    lineHeight: 16
  },
  err: {
    marginTop: 12,
    color: authColors.error,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  }
});
