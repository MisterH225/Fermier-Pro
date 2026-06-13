import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type NoActiveProjectScreenProps = {
  hasArchivedProjects: boolean;
  onCreateProject: () => void;
  onViewArchived: () => void;
};

export function NoActiveProjectScreen({
  hasArchivedProjects,
  onCreateProject,
  onViewArchived
}: NoActiveProjectScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="home" size={80} color={mobileColors.border} />
        </View>

        <Text style={styles.title}>Aucun projet actif</Text>
        <Text style={styles.message}>
          Créez un nouveau projet ou restaurez un projet archivé pour continuer.
        </Text>

        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={onCreateProject}>
            <Ionicons name="add-circle" size={20} color={mobileColors.onAccent} />
            <Text style={styles.primaryBtnText}>Créer un nouveau projet</Text>
          </Pressable>

          {hasArchivedProjects && (
            <Pressable style={styles.secondaryBtn} onPress={onViewArchived}>
              <Ionicons name="archive" size={18} color={mobileColors.accent} />
              <Text style={styles.secondaryBtnText}>
                Voir mes projets archivés
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mobileColors.canvas,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xl
  },
  content: {
    alignItems: "center",
    maxWidth: 320
  },
  iconContainer: {
    marginBottom: mobileSpacing.lg
  },
  title: {
    ...mobileTypography.title,
    fontSize: 22,
    textAlign: "center",
    marginBottom: mobileSpacing.sm
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginBottom: mobileSpacing.xl
  },
  actions: {
    width: "100%",
    gap: mobileSpacing.md
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: mobileColors.accent,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: mobileRadius.md
  },
  primaryBtnText: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.onAccent
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: mobileRadius.md
  },
  secondaryBtnText: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.accent
  }
});
