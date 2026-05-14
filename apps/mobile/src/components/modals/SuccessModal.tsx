import { BlurView } from "expo-blur";
import { useEffect, useRef } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { SuccessModalPayload } from "../../context/ModalContext";

type SuccessModalProps = {
  visible: boolean;
  payload: SuccessModalPayload;
  onClose: () => void;
};

export function SuccessModal({ visible, payload, onClose }: SuccessModalProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible || !payload.autoDismissMs) {
      return;
    }
    timer.current = setTimeout(() => {
      onClose();
    }, payload.autoDismissMs);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [visible, payload.autoDismissMs, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView
            intensity={scheme === "dark" ? 55 : 70}
            tint={scheme === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
        <View style={styles.centerLayer} pointerEvents="box-none">
          <View style={styles.card}>
            <View style={styles.seal}>
              <Ionicons name="checkmark" size={36} color="#1B5E20" />
            </View>
            <Text style={styles.title}>
              {payload.title ?? t("modals.success.title")}
            </Text>
            <Text style={styles.subtitle}>{payload.message}</Text>
            <Pressable
              style={styles.btn}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.btnTx}>{t("modals.success.done")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  centerLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.lg
  },
  card: {
    width: "88%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: mobileSpacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12
  },
  seal: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#C8F5C0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: mobileSpacing.lg
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111111",
    textAlign: "center",
    marginBottom: mobileSpacing.sm
  },
  subtitle: {
    ...mobileTypography.body,
    color: "#666666",
    textAlign: "center",
    marginBottom: mobileSpacing.xl
  },
  btn: {
    width: "100%",
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  btnTx: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16
  }
});
