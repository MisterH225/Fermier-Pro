import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "../../types/navigation";
import { mobileColors, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { DeleteAccountConfirmModal } from "./DeleteAccountConfirmModal";
import { DeleteAccountWarningModal } from "./DeleteAccountWarningModal";

export function DangerZone() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [warningOpen, setWarningOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const startDeletion = () => {
    setConfirmOpen(false);
    setWarningOpen(false);
    navigation.navigate("DeleteAccountProcess");
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.sep} />
      <Text style={styles.zoneLabel}>{t("account.dangerZone.label")}</Text>
      <Pressable
        style={styles.deleteBtn}
        onPress={() => setWarningOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("account.dangerZone.deleteAccount")}
      >
        <Ionicons
          name="trash-outline"
          size={18}
          color={mobileColors.error}
          style={styles.deleteIcon}
        />
        <Text style={styles.deleteTx}>
          {t("account.dangerZone.deleteAccount")}
        </Text>
      </Pressable>

      <DeleteAccountWarningModal
        visible={warningOpen}
        onClose={() => setWarningOpen(false)}
        onContinue={() => {
          setWarningOpen(false);
          setConfirmOpen(true);
        }}
      />
      <DeleteAccountConfirmModal
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={startDeletion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: mobileSpacing.md
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mobileColors.border,
    marginBottom: mobileSpacing.md
  },
  zoneLabel: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    color: mobileColors.error,
    marginBottom: mobileSpacing.sm,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.sm
  },
  deleteIcon: {
    marginRight: 8
  },
  deleteTx: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md,
    color: mobileColors.error,
    fontWeight: "500"
  }
});
