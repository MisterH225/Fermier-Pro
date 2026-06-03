import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BaseModal } from "../modals/BaseModal";
import type { FarmDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type DeleteProjectModalProps = {
  visible: boolean;
  farm: FarmDto | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onArchiveInstead: () => void;
};

export function DeleteProjectModal({
  visible,
  farm,
  onClose,
  onConfirm,
  onArchiveInstead
}: DeleteProjectModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmName, setConfirmName] = useState("");
  const [loading, setLoading] = useState(false);

  const nameMatches = confirmName.trim() === farm?.name;

  const handleClose = () => {
    setStep(1);
    setConfirmName("");
    onClose();
  };

  const handleConfirm = async () => {
    if (!nameMatches) return;
    setLoading(true);
    try {
      await onConfirm();
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  if (!farm) return null;

  return (
    <BaseModal
      visible={visible}
      onClose={handleClose}
      title="Supprimer ce projet"
    >
      <View style={styles.content}>
        {step === 1 && (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="trash" size={48} color={mobileColors.error} />
            </View>

            <View style={styles.warningBadge}>
              <Ionicons name="warning" size={16} color={mobileColors.error} />
              <Text style={styles.warningText}>Action irréversible</Text>
            </View>

            <Text style={styles.message}>
              Cette action est irréversible. Toutes les données de ce projet seront définitivement supprimées.
            </Text>

            <View style={styles.deletedSection}>
              <Text style={styles.deletedTitle}>Données supprimées :</Text>
              <View style={styles.deletedList}>
                <Text style={styles.deletedItem}>✗ Tous les animaux et leur historique</Text>
                <Text style={styles.deletedItem}>✗ Toutes les transactions financières</Text>
                <Text style={styles.deletedItem}>✗ Tous les rapports générés</Text>
                <Text style={styles.deletedItem}>✗ Toutes les données de santé</Text>
                <Text style={styles.deletedItem}>✗ Tous les accès collaborateurs</Text>
              </View>
            </View>

            <Pressable style={styles.archiveInsteadBtn} onPress={onArchiveInstead}>
              <Ionicons name="bulb" size={18} color={mobileColors.accent} />
              <Text style={styles.archiveInsteadText}>
                Archiver plutôt → (conserve vos données)
              </Text>
            </Pressable>

            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={styles.continueBtn}
                onPress={() => setStep(2)}
              >
                <Text style={styles.continueText}>Continuer</Text>
              </Pressable>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle" size={48} color={mobileColors.error} />
            </View>

            <Text style={styles.confirmMessage}>
              Saisissez le nom du projet pour confirmer :
            </Text>

            <View style={styles.projectNamePreview}>
              <Text style={styles.projectNameLabel}>Nom du projet :</Text>
              <Text style={styles.projectNameValue}>{farm.name}</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Saisissez le nom du projet"
              placeholderTextColor={mobileColors.textSecondary}
              value={confirmName}
              onChangeText={setConfirmName}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={() => setStep(1)}>
                <Text style={styles.cancelText}>Retour</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.deleteBtn,
                  (!nameMatches || loading) && styles.btnDisabled
                ]}
                onPress={handleConfirm}
                disabled={!nameMatches || loading}
              >
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={styles.deleteText}>
                  {loading ? "..." : "Supprimer définitivement"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
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
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fef2f2",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.pill,
    alignSelf: "center",
    marginBottom: mobileSpacing.md
  },
  warningText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.error
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginBottom: mobileSpacing.lg
  },
  confirmMessage: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    textAlign: "center",
    marginBottom: mobileSpacing.md
  },
  deletedSection: {
    backgroundColor: "#fef2f2",
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    marginBottom: mobileSpacing.md
  },
  deletedTitle: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.error,
    marginBottom: mobileSpacing.sm
  },
  deletedList: {
    gap: 4
  },
  deletedItem: {
    ...mobileTypography.meta,
    color: mobileColors.error
  },
  archiveInsteadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: mobileSpacing.md,
    marginBottom: mobileSpacing.md
  },
  archiveInsteadText: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  projectNamePreview: {
    backgroundColor: mobileColors.canvas,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    marginBottom: mobileSpacing.md
  },
  projectNameLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  projectNameValue: {
    ...mobileTypography.title,
    fontSize: 16,
    color: mobileColors.textPrimary
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 12,
    ...mobileTypography.body,
    backgroundColor: mobileColors.background,
    marginBottom: mobileSpacing.lg
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
  continueBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.textSecondary,
    alignItems: "center"
  },
  continueText: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: "#fff"
  },
  deleteBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.error,
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  deleteText: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: "#fff"
  },
  btnDisabled: {
    opacity: 0.5
  }
});
