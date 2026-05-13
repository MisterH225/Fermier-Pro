import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../context/SessionContext";
import { createProfile, type ProfileTypeChoice } from "../../lib/api";
import { formatAuthError } from "../../lib/authErrors";
import { isDemoBypassToken } from "../../lib/demoBypass";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const PROFILE_TYPES: ProfileTypeChoice[] = [
  "producer",
  "technician",
  "veterinarian",
  "buyer"
];

function profileIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "producer":
      return "leaf-outline";
    case "technician":
      return "construct-outline";
    case "veterinarian":
      return "medkit-outline";
    case "buyer":
      return "cart-outline";
    default:
      return "person-outline";
  }
}

type ActiveProfileSwitcherModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ActiveProfileSwitcherModal({
  visible,
  onClose
}: ActiveProfileSwitcherModalProps) {
  const { t } = useTranslation();
  const { accessToken, authMe, activeProfileId, setActiveProfileId } =
    useSession();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profiles = authMe?.profiles ?? [];
  const demo = isDemoBypassToken(accessToken);

  const onSelect = async (id: string) => {
    if (id === activeProfileId) {
      onClose();
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await setActiveProfileId(id);
      onClose();
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setBusyId(null);
    }
  };

  const onAddType = async (type: ProfileTypeChoice) => {
    if (demo) {
      Alert.alert("", t("account.addProfileDemoBlocked"));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await createProfile(accessToken, { type });
      await setActiveProfileId(created.id);
      setShowAdd(false);
      onClose();
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={() => {
        setShowAdd(false);
        setError(null);
      }}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("account.switchProfileModalTitle")}</Text>
          <Pressable onPress={onClose} hitSlop={14}>
            <Text style={styles.close}>{t("producer.close")}</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>{t("account.switchProfileSubtitle")}</Text>

        {error ? <Text style={styles.err}>{error}</Text> : null}

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.group}>
            {profiles.map((p, index) => {
              const active = p.id === activeProfileId;
              const loading = busyId === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [
                    styles.row,
                    index < profiles.length - 1 && styles.rowInnerDivider,
                    active && styles.rowActive,
                    pressed && styles.rowPressed
                  ]}
                  onPress={() => void onSelect(p.id)}
                  disabled={loading || Boolean(busyId)}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons
                      name={profileIcon(p.type)}
                      size={22}
                      color={active ? "#fff" : mobileColors.accent}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text
                      style={[styles.rowTitle, active && styles.rowTitleActive]}
                    >
                      {t(`account.profileTypes.${p.type}`, {
                        defaultValue: p.type
                      })}
                    </Text>
                    {p.displayName ? (
                      <Text
                        style={[styles.rowMeta, active && styles.rowMetaActive]}
                        numberOfLines={1}
                      >
                        {p.displayName}
                      </Text>
                    ) : null}
                  </View>
                  {loading ? (
                    <ActivityIndicator color={active ? "#fff" : mobileColors.accent} />
                  ) : active ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#fff"
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={mobileColors.textSecondary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          {!showAdd ? (
            <Pressable
              style={({ pressed }) => [
                styles.addBtn,
                pressed && styles.addBtnPressed
              ]}
              onPress={() => setShowAdd(true)}
              disabled={creating || Boolean(busyId)}
            >
              <Ionicons name="add-circle-outline" size={22} color={mobileColors.accent} />
              <Text style={styles.addBtnLabel}>{t("account.addProfile")}</Text>
            </Pressable>
          ) : (
            <View style={styles.addBlock}>
              <Text style={styles.addHint}>{t("account.addProfileHint")}</Text>
              {creating ? (
                <ActivityIndicator style={styles.creating} />
              ) : (
                <View style={styles.typeGrid}>
                  {PROFILE_TYPES.map((type) => (
                    <Pressable
                      key={type}
                      style={({ pressed }) => [
                        styles.typeChip,
                        pressed && styles.typeChipPressed
                      ]}
                      onPress={() => void onAddType(type)}
                      disabled={Boolean(busyId)}
                    >
                      <Ionicons
                        name={profileIcon(type)}
                        size={20}
                        color={mobileColors.accent}
                      />
                      <Text style={styles.typeChipText}>
                        {t(`account.profileTypes.${type}`, {
                          defaultValue: type
                        })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable
                style={styles.cancelAdd}
                onPress={() => setShowAdd(false)}
                disabled={creating}
              >
                <Text style={styles.cancelAddText}>{t("producer.cancelPhoto")}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: mobileColors.background
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  title: {
    ...mobileTypography.cardTitle,
    fontSize: 18,
    flex: 1,
    marginRight: mobileSpacing.md
  },
  close: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600",
    fontSize: 17
  },
  sub: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.md,
    lineHeight: 22
  },
  err: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    paddingHorizontal: mobileSpacing.lg,
    marginBottom: mobileSpacing.sm
  },
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl
  },
  group: {
    borderRadius: mobileRadius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.surfaceMuted
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted
  },
  rowInnerDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  rowActive: {
    backgroundColor: mobileColors.accent
  },
  rowPressed: {
    opacity: 0.9
  },
  rowIcon: {
    width: 40,
    alignItems: "center"
  },
  rowText: {
    flex: 1,
    marginLeft: mobileSpacing.sm
  },
  rowTitle: {
    ...mobileTypography.cardTitle,
    fontSize: 16,
    color: mobileColors.textPrimary
  },
  rowTitleActive: {
    color: mobileColors.background
  },
  rowMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  rowMetaActive: {
    color: "rgba(255,255,255,0.85)"
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    borderStyle: "dashed"
  },
  addBtnPressed: {
    opacity: 0.85
  },
  addBtnLabel: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.accent,
    fontSize: 16
  },
  addBlock: {
    marginTop: mobileSpacing.lg,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.lg
  },
  addHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md,
    lineHeight: 18
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  typeChipPressed: {
    opacity: 0.88
  },
  typeChipText: {
    ...mobileTypography.body,
    fontSize: 14,
    fontWeight: "500",
    color: mobileColors.textPrimary
  },
  cancelAdd: {
    marginTop: mobileSpacing.md,
    alignSelf: "center",
    padding: mobileSpacing.sm
  },
  cancelAddText: {
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  creating: {
    marginVertical: mobileSpacing.lg
  }
});
