import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PhoneOtpAuth } from "../components/PhoneOtpAuth";
import {
  isApiUrlConfigured,
  isAuthEnvConfigured
} from "../env";

/**
 * Ecran avant session : configuration .env + OTP telephone.
 */
export function LoginGateScreen() {
  const authOk = isAuthEnvConfigured();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCard}>
        <Text style={styles.title}>Fermier Pro</Text>
        <Text style={styles.subtitle}>Connexion</Text>
      </View>

      {!authOk ? (
        <Text style={styles.warn}>
          Copiez apps/mobile/.env.example vers .env et renseignez
          EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY.
        </Text>
      ) : (
        <PhoneOtpAuth />
      )}

      <Text style={styles.section}>API (après connexion)</Text>
      {!isApiUrlConfigured() ? (
        <Text style={styles.warn}>
          Ajoutez EXPO_PUBLIC_API_URL pour charger vos fermes (ex.
          http://10.0.2.2:3000 sur emulateur Android).
        </Text>
      ) : (
        <Text style={styles.ok}>
          API : {process.env.EXPO_PUBLIC_API_URL}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f9f8ea"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40
  },
  heroCard: {
    backgroundColor: "#5d7a1f",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700"
  },
  subtitle: {
    marginTop: 6,
    color: "#dfe8c8",
    fontSize: 14
  },
  section: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2910"
  },
  warn: {
    marginTop: 10,
    color: "#8b4513",
    fontSize: 13,
    lineHeight: 18
  },
  ok: {
    marginTop: 8,
    fontSize: 13,
    color: "#4b513d"
  }
});
