import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createProfile,
  type ProfileTypeChoice
} from "../lib/api";
import { formatAuthError } from "../lib/authErrors";
import { useSession } from "../context/SessionContext";
import { authColors, authRadii } from "../theme/authTheme";

const OPTIONS: Array<{
  type: ProfileTypeChoice;
  title: string;
  subtitle: string;
}> = [
  {
    type: "producer",
    title: "Producteur",
    subtitle: "Gérer tes fermes, animaux et équipe."
  },
  {
    type: "technician",
    title: "Technicien",
    subtitle: "Suivi terrain et interventions chez les éleveurs."
  },
  {
    type: "veterinarian",
    title: "Vétérinaire",
    subtitle: "Consultations, dossiers sanitaires et échanges."
  },
  {
    type: "buyer",
    title: "Acheteur",
    subtitle: "Marché, offres et négociations."
  }
];

/**
 * Une seule fois par compte : choix du métier avant tout tableau de bord.
 */
export function FirstConnectionProfileScreen() {
  const { accessToken, setActiveProfileId, signOut } = useSession();
  const [selected, setSelected] = useState<ProfileTypeChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    if (!selected) {
      setError("Choisis un profil pour continuer.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await createProfile(accessToken, { type: selected });
      await setActiveProfileId(created.id);
    } catch (e: unknown) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.head}>Première connexion</Text>
        <Text style={styles.sub}>
          Choisis ton métier : tu accéderas ensuite à un tableau de bord adapté.
          Tu pourras ajouter d’autres rôles plus tard depuis ton profil.
        </Text>

        <View style={styles.cards}>
          {OPTIONS.map((opt) => {
            const active = selected === opt.type;
            return (
              <TouchableOpacity
                key={opt.type}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => setSelected(opt.type)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>
                  {opt.title}
                </Text>
                <Text style={styles.cardSub}>{opt.subtitle}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.cta, (!selected || busy) && styles.ctaDisabled]}
          onPress={() => void onContinue()}
          disabled={!selected || busy}
          activeOpacity={0.88}
        >
          {busy ? (
            <ActivityIndicator color={authColors.forest} />
          ) : (
            <Text style={styles.ctaLabel}>Continuer</Text>
          )}
        </TouchableOpacity>

        {error ? <Text style={styles.err}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.signOutRow}
          onPress={() => void signOut()}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Text style={styles.signOutText}>Utiliser un autre compte</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: authColors.background
  },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: 32
  },
  head: {
    fontSize: 26,
    fontWeight: "700",
    color: authColors.forest,
    marginBottom: 10
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: authColors.body,
    marginBottom: 22
  },
  cards: {
    gap: 12
  },
  card: {
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: authRadii.input,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: authColors.background
  },
  cardActive: {
    borderColor: authColors.forest,
    backgroundColor: "#f4faf6"
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: authColors.forest,
    marginBottom: 6
  },
  cardTitleActive: {
    color: authColors.forestMuted
  },
  cardSub: {
    fontSize: 14,
    lineHeight: 20,
    color: authColors.body
  },
  cta: {
    marginTop: 26,
    minHeight: 54,
    borderRadius: authRadii.pill,
    backgroundColor: authColors.lime,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  ctaDisabled: {
    opacity: 0.45
  },
  ctaLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: authColors.forest
  },
  err: {
    marginTop: 14,
    color: authColors.error,
    fontSize: 14,
    textAlign: "center"
  },
  signOutRow: {
    marginTop: 28,
    alignSelf: "center",
    paddingVertical: 8
  },
  signOutText: {
    fontSize: 14,
    color: authColors.placeholder,
    textDecorationLine: "underline"
  }
});
