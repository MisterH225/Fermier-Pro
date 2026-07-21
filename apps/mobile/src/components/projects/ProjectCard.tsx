import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FarmDto } from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { producerColors } from "../../theme/producerTheme";
import { marketplaceColors } from "../../theme/marketplaceTheme";

type ProjectCardProps = {
  farm: FarmDto;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore?: () => void;
  onDelete: () => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function ProjectCard({
  farm,
  isActive,
  onSelect,
  onEdit,
  onArchive,
  onRestore,
  onDelete
}: ProjectCardProps) {
  const { t } = useTranslation();
  const isArchived = farm.status === "archived";

  return (
    <Pressable
      style={[
        styles.card,
        isActive && styles.cardActive,
        isArchived && styles.cardArchived
      ]}
      onPress={isArchived ? undefined : onSelect}
    >
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, isArchived && styles.avatarArchived]}>
            <Text style={styles.avatarText}>
              {farm.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {farm.name}
            </Text>
            {isActive && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={mobileColors.accent}
                style={styles.checkmark}
              />
            )}
          </View>
          {farm.address && (
            <Text style={styles.location} numberOfLines={1}>
              {farm.address}
            </Text>
          )}
          <View style={styles.badges}>
            {isActive && (
              <View style={styles.badgeActive}>
                <Text style={styles.badgeActiveText}>Actif</Text>
              </View>
            )}
            {!isActive && !isArchived && (
              <View style={styles.badgeInactive}>
                <Text style={styles.badgeInactiveText}>Inactif</Text>
              </View>
            )}
            {isArchived && (
              <View style={styles.badgeArchived}>
                <Text style={styles.badgeArchivedText}>Archivé</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaText}>
          Créé le {formatDate(farm.createdAt)}
        </Text>
      </View>

      <View style={styles.actions}>
        {!isArchived && (
          <>
            {!isActive && (
              <Pressable style={styles.actionBtn} onPress={onSelect}>
                <Ionicons name="play" size={16} color={mobileColors.accent} />
                <Text style={styles.actionText}>Activer</Text>
              </Pressable>
            )}
            <Pressable style={styles.actionBtn} onPress={onEdit}>
              <Ionicons name="pencil" size={16} color={mobileColors.textSecondary} />
              <Text style={styles.actionTextSecondary}>Modifier</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={onArchive}>
              <Ionicons name="archive" size={16} color={mobileColors.textSecondary} />
              <Text style={styles.actionTextSecondary}>Archiver</Text>
            </Pressable>
          </>
        )}
        {isArchived && onRestore && (
          <Pressable style={styles.actionBtn} onPress={onRestore}>
            <Ionicons name="refresh" size={16} color={mobileColors.accent} />
            <Text style={styles.actionText}>Restaurer</Text>
          </Pressable>
        )}
        <Pressable style={styles.actionBtn} onPress={onDelete}>
          <Ionicons name="trash" size={16} color={mobileColors.error} />
          <Text style={styles.actionTextDanger}>Supprimer</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md
  },
  cardActive: {
    borderColor: mobileColors.accent,
    borderWidth: 2
  },
  cardArchived: {
    opacity: 0.7,
    backgroundColor: mobileColors.canvas
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  avatarContainer: {
    marginRight: mobileSpacing.md
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: mobileRadius.xl,
    backgroundColor: mobileColors.accentSoft,
    justifyContent: "center",
    alignItems: "center"
  },
  avatarArchived: {
    backgroundColor: mobileColors.border
  },
  avatarText: {
    fontSize: mobileFontSize.xl,
    fontWeight: "700",
    color: mobileColors.accent
  },
  info: {
    flex: 1
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  name: {
    ...mobileTypography.title,
    fontSize: mobileFontSize.lg,
    flex: 1
  },
  checkmark: {
    marginLeft: 6
  },
  location: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  badges: {
    flexDirection: "row",
    marginTop: 6,
    gap: 6
  },
  badgeActive: {
    backgroundColor: mobileColors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: mobileRadius.pill
  },
  badgeActiveText: {
    fontSize: mobileFontSize.xs,
    fontWeight: "600",
    color: mobileColors.accent
  },
  badgeInactive: {
    backgroundColor: mobileColors.canvas,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: mobileRadius.pill
  },
  badgeInactiveText: {
    fontSize: mobileFontSize.xs,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  badgeArchived: {
    backgroundColor: producerColors.kpiAmberSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: mobileRadius.pill
  },
  badgeArchivedText: {
    fontSize: mobileFontSize.xs,
    fontWeight: "600",
    color: marketplaceColors.pending
  },
  meta: {
    marginTop: mobileSpacing.sm,
    paddingTop: mobileSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: mobileColors.border
  },
  metaText: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.md,
    paddingTop: mobileSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: mobileColors.border
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.canvas
  },
  actionText: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    color: mobileColors.accent
  },
  actionTextSecondary: {
    fontSize: mobileFontSize.sm,
    fontWeight: "500",
    color: mobileColors.textSecondary
  },
  actionTextDanger: {
    fontSize: mobileFontSize.sm,
    fontWeight: "500",
    color: mobileColors.error
  }
});
