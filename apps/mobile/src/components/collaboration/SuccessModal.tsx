import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Modal } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

export function SuccessModal({ visible, message, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons
              name="checkmark-circle"
              size={48}
              color={mobileColors.success}
            />
          </View>
          <Text style={styles.message}>{message}</Text>
          <Pressable
            onPress={onClose}
            style={styles.btn}
            accessibilityRole="button"
          >
            <Text style={styles.btnTxt}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xl
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.xl,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    gap: mobileSpacing.md
  },
  iconWrap: {
    marginBottom: mobileSpacing.xs
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    textAlign: "center",
    lineHeight: 22
  },
  btn: {
    marginTop: mobileSpacing.xs,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.xxl,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.accent
  },
  btnTxt: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "700"
  }
});
