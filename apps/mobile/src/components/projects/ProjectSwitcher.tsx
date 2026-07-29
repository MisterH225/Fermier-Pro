import { useTranslation } from "react-i18next";
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
import { useScrollBottomPad } from "../../hooks/useScrollBottomPad";
import type { ArchiveFarmReason, FarmDto } from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { ProjectCard } from "./ProjectCard";
import { ArchiveProjectModal } from "./ArchiveProjectModal";
import { DeleteProjectModal } from "./DeleteProjectModal";
import { getUserFacingError } from "../../lib/userFacingError";
import { marketplaceColors } from "../../theme/marketplaceTheme";
import { producerColors } from "../../theme/producerTheme";

type ProjectSwitcherProps = {
  onCreateProject: () => void;
  /** Appelé quand la limite API est atteinte (ouvre Premium). */
  onUpgradeToPremium?: () => void;
  onEditProject: (farm: FarmDto) => void;
  onClose: () => void;
};

export function ProjectSwitcher({
  onCreateProject,
  onUpgradeToPremium,
  onEditProject,
  onClose
}: ProjectSwitcherProps) {
  const { t } = useTranslation();
  const scrollPad = useScrollBottomPad({ includeChrome: false });
  const {
    farms,
    activeFarmId,
    isLoading,
    canCreateNewProject,
    activeFarmsCount,
    maxFarms,
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
        Alert.alert("Erreur", getUserFacingError(e, t));
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
        Alert.alert("Erreur", getUserFacingError(e, t));
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
        Alert.alert("Erreur", getUserFacingError(e, t));
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
      Alert.alert("Erreur", getUserFacingError(e, t));
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
        <Text style={styles.title}>{t("producer.projects.title")}</Text>
        <Text style={styles.subtitle}>
          {maxFarms == null
            ? t("producer.projects.activeCountUnlimited", {
                count: activeFarmsCount
              })
            : t("producer.projects.activeCountLimited", {
                count: activeFarmsCount,
                max: maxFarms
              })}
        </Text>
      </View>

      {!canCreateNewProject ? (
        <View style={styles.limitBanner}>
          <Ionicons name="warning" size={18} color={marketplaceColors.pending} />
          <View style={styles.limitBannerBody}>
            <Text style={styles.limitText}>
              {t("producer.projects.limitReached", { count: maxFarms ?? 0 })}
            </Text>
            {onUpgradeToPremium ? (
              <Pressable onPress={onUpgradeToPremium} testID="project-switcher-upgrade">
                <Text style={styles.limitCta}>
                  {t("subscriptionLimits.upgrade.upgradeCta")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPad }]}
        showsVerticalScrollIndicator={false}
      >
        {activeFarms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("producer.projects.activeSection")}</Text>
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
            <Text style={styles.sectionTitle}>{t("producer.projects.archivedSection")}</Text>
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
          style={styles.createBtn}
          onPress={() => {
            if (!canCreateNewProject && onUpgradeToPremium) {
              onUpgradeToPremium();
              return;
            }
            onCreateProject();
          }}
          testID="project-switcher-create"
        >
          <Ionicons
            name={!canCreateNewProject && onUpgradeToPremium ? "diamond" : "add-circle"}
            size={20}
            color={mobileColors.background}
          />
          <Text style={styles.createBtnText}>
            {!canCreateNewProject && onUpgradeToPremium
              ? t("subscriptionLimits.upgrade.upgradeCta")
              : t("producer.projects.newProject")}
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
          <ActivityIndicator size="large" color={mobileColors.onAccent} />
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
    fontSize: mobileFontSize.xl
  },
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  limitBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: producerColors.kpiAmberSoft,
    padding: mobileSpacing.md,
    marginHorizontal: mobileSpacing.md,
    marginTop: mobileSpacing.md,
    borderRadius: mobileRadius.md
  },
  limitBannerBody: {
    flex: 1,
    gap: 6
  },
  limitText: {
    ...mobileTypography.meta,
    color: marketplaceColors.pending
  },
  limitCta: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: producerColors.primary,
    textDecorationLine: "underline"
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
    color: mobileColors.onAccent
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
