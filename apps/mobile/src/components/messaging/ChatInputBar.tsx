import { Ionicons } from "@expo/vector-icons";
import {
  EncodingType,
  readAsStringAsync
} from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  PhoneWarningBanner,
  type PhoneWarningVariant
} from "../chat/PhoneWarningBanner";
import { containsPhone } from "../../services/chat/PhoneNumberDetector";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

type PendingImage = {
  uri: string;
  mimeType: string;
  analyzing: boolean;
  allowed: boolean | null;
};

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onAnalyzeImage: (base64: string, mimeType: string) => Promise<{ allowed: boolean }>;
  onSendImage?: (uri: string, mimeType: string) => Promise<void>;
  sending?: boolean;
  placeholder?: string;
  paddingBottom?: number;
  phoneWarningMessage?: string;
  phoneMaskedMessage?: string;
  imageBlockedMessage?: string;
  imageAnalyzingMessage?: string;
  externalWarning?: PhoneWarningVariant | null;
};

export function ChatInputBar({
  value,
  onChangeText,
  onSend,
  onAnalyzeImage,
  onSendImage,
  sending = false,
  placeholder = "Votre message…",
  paddingBottom = 0,
  phoneWarningMessage = "Les numéros de téléphone sont automatiquement masqués pour votre sécurité.",
  phoneMaskedMessage = "Numéro masqué automatiquement pour votre protection.",
  imageBlockedMessage = "Cette image semble contenir un numéro de téléphone et ne peut pas être envoyée.",
  imageAnalyzingMessage = "Vérification sécurité…",
  externalWarning = null
}: Props) {
  const [realtimePhone, setRealtimePhone] = useState(false);
  const [hideRealtimeTimer, setHideRealtimeTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [bannerVariant, setBannerVariant] = useState<PhoneWarningVariant | null>(
    null
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const detected = containsPhone(value);
      setRealtimePhone(detected);
      if (!detected && hideRealtimeTimer) {
        clearTimeout(hideRealtimeTimer);
        const t = setTimeout(() => {
          setBannerVariant((v) => (v === "realtime_warning" ? null : v));
        }, 3000);
        setHideRealtimeTimer(t);
      }
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, hideRealtimeTimer]);

  useEffect(() => {
    if (realtimePhone) {
      setBannerVariant("realtime_warning");
      if (hideRealtimeTimer) {
        clearTimeout(hideRealtimeTimer);
        setHideRealtimeTimer(null);
      }
    }
  }, [realtimePhone, hideRealtimeTimer]);

  useEffect(() => {
    if (externalWarning) {
      setBannerVariant(externalWarning);
    }
  }, [externalWarning]);

  const analyzePickedImage = useCallback(
    async (uri: string, mimeType: string) => {
      setPendingImage({ uri, mimeType, analyzing: true, allowed: null });
      try {
        const base64 = await readAsStringAsync(uri, {
          encoding: EncodingType.Base64
        });
        const result = await onAnalyzeImage(base64, mimeType);
        if (!result.allowed) {
          setPendingImage(null);
          setBannerVariant("image_blocked");
          return;
        }
        setPendingImage({ uri, mimeType, analyzing: false, allowed: true });
      } catch {
        setPendingImage(null);
        setBannerVariant("image_blocked");
      }
    },
    [onAnalyzeImage]
  );

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82
    });
    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }
    const asset = result.assets[0];
    await analyzePickedImage(asset.uri, asset.mimeType ?? "image/jpeg");
  };

  const clearPendingImage = () => {
    setPendingImage(null);
  };

  const canSendText = value.trim().length > 0 && !sending && !pendingImage?.analyzing;
  const canSendImage =
    pendingImage?.allowed === true && !sending && !pendingImage.analyzing;

  const handleSend = async () => {
    if (canSendImage && pendingImage && onSendImage) {
      try {
        await onSendImage(pendingImage.uri, pendingImage.mimeType);
        setPendingImage(null);
      } catch (err) {
        Alert.alert(
          "Envoi impossible",
          err instanceof Error ? err.message : String(err)
        );
      }
      return;
    }
    if (!canSendText) {
      return;
    }
    onSend();
  };

  const bannerMessage =
    bannerVariant === "text_masked"
      ? phoneMaskedMessage
      : bannerVariant === "image_blocked"
        ? imageBlockedMessage
        : phoneWarningMessage;

  return (
    <View style={paddingBottom > 0 ? { paddingBottom } : undefined}>
      <PhoneWarningBanner
        variant={bannerVariant ?? "realtime_warning"}
        visible={bannerVariant != null}
        message={bannerMessage}
        onHide={() => setBannerVariant(null)}
      />
      {pendingImage ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: pendingImage.uri }} style={styles.preview} />
          {pendingImage.analyzing ? (
            <View style={styles.previewOverlay}>
              <ActivityIndicator color={mobileColors.onAccent} />
              <Text style={styles.previewOverlayText}>{imageAnalyzingMessage}</Text>
            </View>
          ) : null}
          {!pendingImage.analyzing ? (
            <Pressable style={styles.previewClose} onPress={clearPendingImage} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={mobileColors.onAccent} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.bar}>
        <Pressable
          style={styles.attachBtn}
          hitSlop={8}
          onPress={() => void pickImage()}
          disabled={sending || Boolean(pendingImage?.analyzing)}
        >
          <Ionicons
            name="attach-outline"
            size={22}
            color={mobileColors.textSecondary}
          />
        </Pressable>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={mobileColors.textSecondary}
          multiline
          maxLength={4000}
          editable={!sending && !pendingImage?.analyzing}
        />
        <Pressable
          style={[
            styles.sendBtn,
            !(canSendText || canSendImage) && styles.sendBtnDisabled
          ]}
          onPress={() => void handleSend()}
          disabled={!(canSendText || canSendImage)}
          hitSlop={8}
        >
          {sending ? (
            <ActivityIndicator color={mobileColors.onAccent} size="small" />
          ) : (
            <Ionicons name="send" size={18} color={mobileColors.onAccent} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    backgroundColor: mobileColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  attachBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    fontSize: 15,
    color: mobileColors.textPrimary
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnDisabled: {
    backgroundColor: mobileColors.border
  },
  previewWrap: {
    marginHorizontal: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    overflow: "hidden",
    height: 120,
    backgroundColor: mobileColors.surfaceMuted
  },
  preview: {
    width: "100%",
    height: "100%"
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  previewOverlayText: {
    color: mobileColors.onAccent,
    fontSize: 12,
    fontWeight: "600"
  },
  previewClose: {
    position: "absolute",
    top: 8,
    right: 8
  }
});
