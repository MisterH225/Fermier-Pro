import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseInviteTokenFromUrl } from "../../lib/pendingInviteToken";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onTokenScanned: (token: string) => void;
};

export function InviteQrScannerModal({ visible, onClose, onTokenScanned }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  const handleScan = useCallback(
    (result: { data: string }) => {
      if (locked) {
        return;
      }
      const token =
        parseInviteTokenFromUrl(result.data) ?? result.data.trim();
      if (token.length < 16) {
        return;
      }
      setLocked(true);
      onTokenScanned(token);
      onClose();
      setTimeout(() => setLocked(false), 800);
    },
    [locked, onClose, onTokenScanned]
  );

  const handleClose = () => {
    setLocked(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("invite.scanQrTitle")}</Text>
          <Pressable
            onPress={handleClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Text style={styles.closeTxt}>{t("common.close")}</Text>
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.centered}>
            <ActivityIndicator color={mobileColors.accent} size="large" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.centered}>
            <Text style={styles.permissionTxt}>
              {t("invite.cameraPermissionBody")}
            </Text>
            <Pressable
              onPress={() => void requestPermission()}
              style={styles.permissionBtn}
              accessibilityRole="button"
            >
              <Text style={styles.permissionBtnTxt}>
                {t("invite.cameraPermissionCta")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={locked ? undefined : handleScan}
            />
            <View style={styles.overlay}>
              <View style={styles.frame} />
              <Text style={styles.hint}>{t("invite.scanQrHint")}</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const FRAME = 248;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileColors.textPrimary
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.onAccent,
    flex: 1
  },
  closeBtn: {
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md
  },
  closeTxt: {
    ...mobileTypography.meta,
    color: mobileColors.onAccent,
    fontWeight: "700"
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing.xl,
    gap: mobileSpacing.lg
  },
  permissionTxt: {
    ...mobileTypography.body,
    color: mobileColors.onAccent,
    textAlign: "center",
    lineHeight: 22
  },
  permissionBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.xl
  },
  permissionBtnTxt: {
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: 16
  },
  cameraWrap: {
    flex: 1,
    overflow: "hidden"
  },
  camera: {
    flex: 1
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.lg
  },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: mobileRadius.lg,
    borderWidth: 2,
    borderColor: mobileColors.onAccent,
    backgroundColor: "transparent"
  },
  hint: {
    ...mobileTypography.body,
    color: mobileColors.onAccent,
    textAlign: "center",
    paddingHorizontal: mobileSpacing.xl,
    lineHeight: 20
  }
});
