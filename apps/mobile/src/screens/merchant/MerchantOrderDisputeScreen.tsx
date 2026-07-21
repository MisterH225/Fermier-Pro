import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../context/SessionContext";
import {
  fetchMerchantOrder,
  openMerchantOrderDispute,
  respondMerchantOrderDispute
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileSpacing, mobileColors, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantOrderDispute">;

export function MerchantOrderDisputeScreen({ route }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId, authMe } = useSession();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const q = useQuery({
    queryKey: ["merchant-order", route.params.orderId],
    queryFn: () =>
      fetchMerchantOrder(accessToken!, route.params.orderId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const openM = useMutation({
    mutationFn: () =>
      openMerchantOrderDispute(
        accessToken!,
        route.params.orderId,
        { reason: reason.trim() },
        activeProfileId
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["merchant-order", route.params.orderId]
      });
      await queryClient.invalidateQueries({ queryKey: ["merchant-orders-buyer"] });
      Alert.alert(t("merchant.dispute.opened"));
    },
    onError: (e) => Alert.alert(formatApiError(e))
  });

  const respondM = useMutation({
    mutationFn: () =>
      respondMerchantOrderDispute(
        accessToken!,
        route.params.orderId,
        { note: note.trim() },
        activeProfileId
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["merchant-order", route.params.orderId]
      });
      Alert.alert(t("merchant.dispute.responded"));
      setNote("");
    },
    onError: (e) => Alert.alert(formatApiError(e))
  });

  const order = q.data;
  const isSeller = authMe?.user.id === order?.sellerUserId;
  const hasDispute = Boolean(order?.dispute);

  if (q.isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={merchantColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("merchant.dispute.title")}</Text>
        <Text style={styles.subtitle}>{t("merchant.dispute.subtitle")}</Text>

        {!hasDispute ? (
          <>
            <Text style={styles.label}>{t("merchant.dispute.reasonLabel")}</Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder={t("merchant.dispute.reasonPh")}
              multiline
            />
            <Pressable
              style={styles.btn}
              disabled={openM.isPending || reason.trim().length < 5}
              onPress={() => openM.mutate()}
            >
              <Text style={styles.btnTx}>{t("merchant.dispute.submit")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>{t("merchant.dispute.current")}</Text>
              <Text>{order!.dispute!.reason}</Text>
            </View>
            <Text style={styles.label}>
              {isSeller
                ? t("merchant.dispute.sellerReply")
                : t("merchant.dispute.buyerReply")}
            </Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder={t("merchant.dispute.notePh")}
              multiline
            />
            <Pressable
              style={styles.btn}
              disabled={respondM.isPending || note.trim().length < 3}
              onPress={() => respondM.mutate()}
            >
              <Text style={styles.btnTx}>{t("merchant.dispute.sendNote")}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: merchantColors.canvas },
  scroll: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: mobileFontSize.xl, fontWeight: "800" },
  subtitle: { color: merchantColors.textSecondary },
  label: { fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: merchantColors.border,
    borderRadius: merchantRadius.button,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    minHeight: 100,
    textAlignVertical: "top"
  },
  btn: {
    backgroundColor: merchantColors.primary,
    padding: mobileSpacing.md,
    borderRadius: merchantRadius.button,
    alignItems: "center"
  },
  btnTx: { color: mobileColors.background, fontWeight: "700" },
  box: {
    backgroundColor: mobileColors.background,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: merchantColors.border,
    gap: 6
  },
  boxTitle: { fontWeight: "700" }
});
