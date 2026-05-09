import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.title}>Fermier Pro</Text>
        <Text style={styles.subtitle}>Smart Livestock Platform</Text>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>+16%</Text>
          <Text style={styles.kpiLabel}>Croissance</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>92%</Text>
          <Text style={styles.kpiLabel}>Sante globale</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>MVP bootstrap pret</Text>
      <Text style={styles.bodyText}>
        Prochaine etape: auth multi-profils, gestion ferme, animaux et suivi
        quotidien.
      </Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f8ea",
    paddingHorizontal: 20,
    paddingTop: 70
  },
  heroCard: {
    backgroundColor: "#5d7a1f",
    borderRadius: 24,
    padding: 20
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "700"
  },
  subtitle: {
    marginTop: 6,
    color: "#dfe8c8",
    fontSize: 14
  },
  kpiRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14
  },
  kpiValue: {
    color: "#253107",
    fontWeight: "700",
    fontSize: 22
  },
  kpiLabel: {
    marginTop: 4,
    color: "#6d745b",
    fontSize: 12
  },
  sectionTitle: {
    marginTop: 26,
    fontSize: 20,
    color: "#1f2910",
    fontWeight: "700"
  },
  bodyText: {
    marginTop: 10,
    color: "#4b513d",
    fontSize: 14,
    lineHeight: 20
  }
});
