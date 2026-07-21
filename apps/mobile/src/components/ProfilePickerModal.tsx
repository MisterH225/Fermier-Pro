import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import type { AuthMeResponse } from "../lib/api";
import { mobileColors, mobileRadius, mobileFontSize } from "../theme/mobileTheme";
import { producerColors } from "../theme/producerTheme";
import { uiNamedColors } from "../theme/uiNamedColors";

const PROFILE_LABEL: Record<string, string> = {
  producer: "Producteur",
  technician: "Technicien",
  veterinarian: "Vétérinaire",
  buyer: "Acheteur"
};

function profileLabel(
  p: AuthMeResponse["profiles"][0],
  isActive: boolean
): string {
  const base = p.displayName?.trim() || PROFILE_LABEL[p.type] || p.type;
  return isActive ? `${base} (actif)` : base;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  profiles: AuthMeResponse["profiles"];
  activeProfileId: string | null;
  onSelect: (id: string) => void;
};

export function ProfilePickerModal({
  visible,
  onClose,
  profiles,
  activeProfileId,
  onSelect
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Profil actif</Text>
          <Text style={styles.hint}>
            Le profil sert de contexte pour les actions futures (ferme,
            marketplace).
          </Text>
          {profiles.map((p) => {
            const active = p.id === activeProfileId;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => {
                  onSelect(p.id);
                  onClose();
                }}
              >
                <Text style={styles.rowText}>{profileLabel(p, active)}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Fermer</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Bouton header compact pour ouvrir le sélecteur */
export function ProfileSwitcherButton({
  profiles,
  activeProfileId,
  onOpen
}: {
  profiles: AuthMeResponse["profiles"];
  activeProfileId: string | null;
  onOpen: () => void;
}) {
  const active = profiles.find((p) => p.id === activeProfileId);
  const label = active
    ? active.displayName?.trim() ||
      PROFILE_LABEL[active.type] ||
      active.type
    : "Profil";

  return (
    <TouchableOpacity
      onPress={onOpen}
      style={styles.miniBtn}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
    >
      <Text style={styles.miniBtnText} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    paddingHorizontal: 10,
    paddingBottom: 8
  },
  sheet: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.xl,
    overflow: "hidden",
    padding: 20,
    paddingBottom: 28,
    maxHeight: "70%"
  },
  title: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: producerColors.oliveDark,
    marginBottom: 8
  },
  hint: {
    fontSize: mobileFontSize.sm,
    color: producerColors.oliveMuted,
    marginBottom: 16,
    lineHeight: 18
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: producerColors.oliveBorder,
    backgroundColor: mobileColors.surface
  },
  rowActive: {
    borderColor: mobileColors.accent,
    backgroundColor: uiNamedColors.cF0F4E4
  },
  rowText: {
    fontSize: mobileFontSize.lg,
    color: producerColors.oliveDark
  },
  cancel: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center"
  },
  cancelText: {
    color: mobileColors.accent,
    fontWeight: "600"
  },
  miniBtn: {
    maxWidth: 140,
    paddingHorizontal: 4
  },
  miniBtnText: {
    color: mobileColors.onAccent,
    fontSize: mobileFontSize.md,
    fontWeight: "600"
  }
});
