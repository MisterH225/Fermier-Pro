import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BaseModal } from "../modals/BaseModal";
import type { ArchiveFarmReason, FarmDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { marketplaceColors } from "../../theme/marketplaceTheme";

type ArchiveProjectModalProps = {
  visible: boolean;
  farm: FarmDto | null;
  onClose: () => void;
  onConfirm: (reason?: ArchiveFarmReason) => Promise<void>;
};

const ARCHIVE_REASONS: { value: ArchiveFarmReason; label: string }[] = [
  { value: "temporarily_inactive", label: "Ferme temporairement inactive" },
  { value: "restructuring", label: "Restructuration" },
  { value: "end_of_season", label: "Fin de saison" },
  { value: "other", label: "Autre" }
];

export function ArchiveProjectModal({
  visible,
  farm,
  onClose,
  onConfirm
}: ArchiveProjectModalProps) {
  const [selectedReason, setSelectedReason] = useState<ArchiveFarmReason | undefined>();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(selectedReason);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!farm) return null;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title="Archiver ce projet"
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="archive" size={48} color={marketplaceColors.pending} />
        </View>

        <Text style={styles.message}>
          Ce projet sera archivé. Toutes vos données sont conservées et le projet peut être restauré à tout moment.
        </Text>

        <View style={styles.preservedSection}>
          <Text style={styles.preservedTitle}>Données conservées :</Text>
          <View style={styles.preservedList}>
            <Text style={styles.preservedItem}>✅ Cheptel et historique</Text>
            <Text style={styles.preservedItem}>✅ Données financières</Text>
            <Text style={styles.preservedItem}>✅ Santé et vaccinations</Text>
            <Text style={styles.preservedItem}>✅ Gestations et reproductions</Text>
            <Text style={styles.preservedItem}>✅ Rapports générés</Text>
          </View>
        </View>

        <View style={styles.reasonSection}>
          <Text style={styles.reasonLabel}>Raison de l'archivage (optionnel)</Text>
          {ARCHIVE_REASONS.map((reason) => (
            <Pressable
              key={reason.value}
              style={[
                styles.reasonOption,
                selectedReason === reason.value && styles.reasonOptionSelected
              ]}
              onPress={() => setSelectedReason(reason.value)}
            >
              <View
                style={[
                  styles.radio,
                  selectedReason === reason.value && styles.radioSelected
                ]}
              >
                {selectedReason === reason.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text style={styles.reasonText}>{reason.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
          <Pressable
            style={[styles.confirmBtn, loading && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={loading}
          >
            <Ionicons name="archive" size={18} color={mobileColors.onAccent} />
            <Text style={styles.confirmText}>
              {loading ? "..." : "Archiver"}
            </Text>
          </Pressable>
        </View>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: mobileSpacing.md
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: mobileSpacing.md
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginBottom: mobileSpacing.lg
  },
  preservedSection: {
    backgroundColor: mobileColors.canvas,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    marginBottom: mobileSpacing.lg
  },
  preservedTitle: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  preservedList: {
    gap: 4
  },
  preservedItem: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  reasonSection: {
    marginBottom: mobileSpacing.lg
  },
  reasonLabel: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    marginBottom: 4
  },
  reasonOptionSelected: {
    backgroundColor: mobileColors.accentSoft
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: mobileRadius.sm,
    borderWidth: 2,
    borderColor: mobileColors.border,
    marginRight: mobileSpacing.sm,
    justifyContent: "center",
    alignItems: "center"
  },
  radioSelected: {
    borderColor: mobileColors.accent
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileColors.accent
  },
  reasonText: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  actions: {
    flexDirection: "row",
    gap: mobileSpacing.md
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    alignItems: "center"
  },
  cancelText: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: mobileRadius.md,
    backgroundColor: marketplaceColors.pending,
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  confirmText: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.onAccent
  },
  btnDisabled: {
    opacity: 0.6
  }
});
