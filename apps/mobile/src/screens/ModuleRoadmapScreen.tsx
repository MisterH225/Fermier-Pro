import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ModuleRoadmap">;

export function ModuleRoadmapScreen({ route }: Props) {
  const { title, body } = route.params;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.note}>
        <Text style={styles.noteText}>
          Les routes API correspondantes sont déjà protégées par les feature flags
          côté serveur ; cette vue prépare l’intégration mobile complète.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f9f8ea"
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2910",
    marginBottom: 14
  },
  body: {
    fontSize: 16,
    color: "#4b513d",
    lineHeight: 24
  },
  note: {
    marginTop: 28,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#edece4",
    borderWidth: 1,
    borderColor: "#d4dac8"
  },
  noteText: {
    fontSize: 13,
    color: "#6d745b",
    lineHeight: 20
  }
});
