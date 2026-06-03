import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useActiveProject } from "../../context/ActiveProjectContext";
import type { ArchiveFarmReason, FarmDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { ProjectCard } from "./ProjectCard";
import { ArchiveProjectModal } from "./ArchiveProjectModal";
import { DeleteProjectModal } from "./DeleteProjectModal";

type ProjectSwitcherProps = {
  onCreateProject: () => void;
  onEditProject: (farm: FarmDto) => void;
  onClose: () => void;
};

export function ProjectSwitcher({
  onCreateProject,
  onEditProject,
  onClose
}: ProjectSwitcherProps) {
  const {
    farms,
    activeFarmId,
    isLoading,
    canCreateNewProject,
    activeFarmsCount,
    setActiveFarm,
    archiveFarm,
    restoreFarm,
    deleteFarm
  } = useActiveProject();

  const [archiveModalFarm, setArchiveModalFarm] = useState<FarmDto | null>(null);
  const [deleteModalFarm, setDeleteModalFarm] = useState<FarmDto | null>(null);
  const [processing, setProcessing] = useState(false);

  const activeFarms = farms.filter((f) => f.status === "active");
  const archivedFarms = farms.filter((f) => f.status === "archived");

  const handleSelectFarm = useCallback(
    async (farmId: string) => {
      if (farmId === activeFarmId) return;
      setProcessing(true);
      try {
        await setActiveFarm(farmId);
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setProcessing(false);
      }
    },
    [activeFarmId, setActiveFarm, onClose]
  );

  const handleArchive = useCallback(
    async (reason?: ArchiveFarmReason) => {
      if (!archiveModalFarm) return;
      setProcessing(true);
      try {
        await archiveFarm(archiveModalFarm.id, reason);
        setArchiveModalFarm(null);
      } catch (e) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setProcessing(false);
      }
    },
    [archiveModalFarm, archiveFarm]
  );

  const handleRestore = useCallback(
    async (farmId: string) => {
      setProcessing(true);
      try {
        await restoreFarm(farmId);
      } catch (e) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setProcessing(false);
      }
    },
    [restoreFarm]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteModalFarm) return;
    setProcessing(true);
    try {
      await deleteFarm(deleteModalFarm.id);
      setDeleteModalFarm(null);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setProcessing(false);
    }
  }, [deleteModalFarm, deleteFarm]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes projets</Text>
        <Text style={styles.subtitle}>
          {activeFarmsCount} actif{activeFarmsCount > 1 ? "s" : ""} sur 3 max
        </Text>
      </View>

      {!canCreateNewProject && (
        <View style={styles.limitBanner}>
          <Ionicons name="warning" size={18} color="#d97706" />
          <Text style={styles.limitText}>
            Limite de 3 projets atteinte. Archivez un projet pour en créer un nouveau.
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeFarms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projets actifs</Text>
            {activeFarms.map((farm) => (
              <ProjectCard
                key={farm.id}
                farm={farm}
                isActive={farm.id === activeFarmId}
                onSelect={() => void handleSelectFarm(farm.id)}
                onEdit={() => onEditProject(farm)}
                onArchive={() => setArchiveModalFarm(farm)}
                onDelete={() => setDeleteModalFarm(farm)}
              />
            ))}
          </View>
        )}

        {archivedFarms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projets archivés</Text>
            {archivedFarms.map((farm) => (
              <ProjectCard
                key={farm.id}
                farm={farm}
                isActive={false}
                onSelect={() => {}}
                onEdit={() => onEditProject(farm)}
                onArchive={() => {}}
                onRestore={() => void handleRestore(farm.id)}
                onDelete={() => setDeleteModalFarm(farm)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.createBtn,
            !canCreateNewProject && styles.createBtnDisabled
          ]}
          onPress={onCreateProject}
          disabled={!canCreateNewProject}
        >
          <Ionicons
            name="add-circle"
            size={20}
            color={canCreateNewProject ? "#fff" : mobileColors.textSecondary}
          />
          <Text
            style={[
              styles.createBtnText,
              !canCreateNewProject && styles.createBtnTextDisabled
            ]}
          >
            Nouveau projet
          </Text>
        </Pressable>
      </View>

      <ArchiveProjectModal
        visible={archiveModalFarm !== null}
        farm={archiveModalFarm}
        onClose={() => setArchiveModalFarm(null)}
        onConfirm={handleArchive}
      />

      <DeleteProjectModal
        visible={deleteModalFarm !== null}
        farm={deleteModalFarm}
        onClose={() => setDeleteModalFarm(null)}
        onConfirm={handleDelete}
        onArchiveInstead={() => {
          if (deleteModalFarm) {
            setDeleteModalFarm(null);
            setArchiveModalFarm(deleteModalFarm);
          }
        }}
      />

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xl
  },
  header: {
    padding: mobileSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.border
  },
  title: {
    ...mobileTypography.title,
    fontSize: 20
  },
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    padding: mobileSpacing.md,
    marginHorizontal: mobileSpacing.md,
    marginTop: mobileSpacing.md,
    borderRadius: mobileRadius.md
  },
  limitText: {
    flex: 1,
    ...mobileTypography.meta,
    color: "#d97706"
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: mobileSpacing.md
  },
  section: {
    marginBottom: mobileSpacing.lg
  },
  sectionTitle: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  footer: {
    padding: mobileSpacing.md,
    borderTopWidth: 1,
    borderTopColor: mobileColors.border
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: mobileColors.accent,
    paddingVertical: 14,
    borderRadius: mobileRadius.md
  },
  createBtnDisabled: {
    backgroundColor: mobileColors.canvas,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  createBtnText: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: "#fff"
  },
  createBtnTextDisabled: {
    color: mobileColors.textSecondary
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center"
  }
});
