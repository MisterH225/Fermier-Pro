import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RefuseModal } from "../../components/onboarding/RefuseModal";
import { useSession } from "../../context/SessionContext";
import { acceptCgu, fetchCguCurrent } from "../../lib/api";
import { formatAuthError } from "../../lib/authErrors";
import { authColors, authRadii } from "../../theme/authTheme";
import { PrivacyPolicyScreen } from "./PrivacyPolicyScreen";

const LOGO = require("../../../assets/images/fermier-pro-logo-nobg.png");

type Props = {
  onAccepted: () => void;
};

export function CGUScreen({ onAccepted }: Props) {
  const { t } = useTranslation();
  const { accessToken, signOut, refreshAuthMe } = useSession();
  const { width: winW } = useWindowDimensions();
  const logoW = Math.min(winW - 80, 200);

  const [checked, setChecked] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const cguQuery = useQuery({
    queryKey: ["cguCurrent"],
    queryFn: () => fetchCguCurrent(accessToken)
  });

  const acceptMut = useMutation({
    mutationFn: async () => {
      const version = cguQuery.data?.version ?? "1.0";
      return acceptCgu(accessToken, version);
    },
    onSuccess: async () => {
      await refreshAuthMe();
      onAccepted();
    },
    onError: (e: unknown) => {
      Alert.alert(t("cgu.errorTitle"), formatAuthError(e));
    }
  });

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const threshold = 32;
    if (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - threshold
    ) {
      setScrolledToEnd(true);
    }
  }, []);

  const canContinue = checked && scrolledToEnd && !acceptMut.isPending;

  const onQuitApp = () => {
    setRefuseOpen(false);
    if (Platform.OS === "android") {
      BackHandler.exitApp();
      return;
    }
    void signOut();
  };

  if (privacyOpen && cguQuery.data?.privacyPolicyContent) {
    return (
      <PrivacyPolicyScreen
        content={cguQuery.data.privacyPolicyContent}
        onClose={() => setPrivacyOpen(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Image
          source={LOGO}
          style={{ width: logoW, height: Math.round(logoW * (295 / 601)) }}
          resizeMode="contain"
          accessibilityLabel="Fermier Pro"
        />
        <Text style={styles.title}>{t("cgu.title")}</Text>
        <Text style={styles.subtitle}>{t("cgu.subtitle")}</Text>
      </View>

      {cguQuery.isPending ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={authColors.forest} />
        </View>
      ) : cguQuery.isError ? (
        <View style={styles.loader}>
          <Text style={styles.err}>{formatAuthError(cguQuery.error)}</Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator
          >
            <Text style={styles.cguBody}>{cguQuery.data?.content ?? ""}</Text>
          </ScrollView>
          {!scrolledToEnd ? (
            <Text style={styles.scrollHint}>{t("cgu.scrollHint")}</Text>
          ) : null}
        </>
      )}

      <View style={styles.footer}>
        <Pressable
          style={styles.checkRow}
          onPress={() => setChecked((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <View style={[styles.checkbox, checked && styles.checkboxOn]}>
            {checked ? (
              <Ionicons name="checkmark" size={16} color={authColors.forest} />
            ) : null}
          </View>
          <Text style={styles.checkLabel}>{t("cgu.acceptLabel")}</Text>
        </Pressable>

        <Pressable
          style={styles.privacyLink}
          onPress={() => setPrivacyOpen(true)}
          disabled={!cguQuery.data}
        >
          <Text style={styles.privacyLinkText}>{t("cgu.privacyLink")}</Text>
        </Pressable>

        <Pressable
          style={[styles.cta, !canContinue && styles.ctaDisabled]}
          onPress={() => acceptMut.mutate()}
          disabled={!canContinue}
        >
          {acceptMut.isPending ? (
            <ActivityIndicator color={authColors.forest} />
          ) : (
            <Text style={styles.ctaLabel}>{t("cgu.continue")}</Text>
          )}
        </Pressable>

        <Pressable style={styles.refuseBtn} onPress={() => setRefuseOpen(true)}>
          <Text style={styles.refuseText}>{t("cgu.refuse")}</Text>
        </Pressable>
      </View>

      <RefuseModal
        visible={refuseOpen}
        onClose={() => setRefuseOpen(false)}
        onReread={() => setRefuseOpen(false)}
        onQuit={onQuitApp}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: authColors.background },
  header: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 8
  },
  title: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: "700",
    color: authColors.forest,
    textAlign: "center"
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: authColors.body,
    textAlign: "center"
  },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  err: { color: authColors.error, textAlign: "center", padding: 20 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingVertical: 12 },
  cguBody: {
    fontSize: 14,
    lineHeight: 22,
    color: authColors.body
  },
  scrollHint: {
    fontSize: 12,
    color: authColors.placeholder,
    textAlign: "center",
    paddingBottom: 4,
    paddingHorizontal: 22
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: authColors.border,
    backgroundColor: authColors.background
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: authColors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  checkboxOn: {
    borderColor: authColors.forest,
    backgroundColor: "#e2f0e8"
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: authColors.forest,
    fontWeight: "600"
  },
  privacyLink: { alignSelf: "center", marginBottom: 12, paddingVertical: 4 },
  privacyLinkText: {
    fontSize: 14,
    color: authColors.forest,
    textDecorationLine: "underline",
    fontWeight: "600"
  },
  cta: {
    minHeight: 52,
    borderRadius: authRadii.pill,
    backgroundColor: authColors.lime,
    alignItems: "center",
    justifyContent: "center"
  },
  ctaDisabled: { opacity: 0.4 },
  ctaLabel: { fontSize: 17, fontWeight: "700", color: authColors.forest },
  refuseBtn: { marginTop: 12, alignItems: "center", paddingVertical: 8 },
  refuseText: { fontSize: 14, color: authColors.error, fontWeight: "600" }
});
