import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useScreenTitle } from "../../hooks/useScreenTitle";
import { useScrollBottomPad } from "../../hooks/useScrollBottomPad";
import { useSession } from "../../context/SessionContext";
import {
  createFinanceCategory,
  deleteFinanceCategory,
  fetchFinanceCategories,
  type FinanceCategoryDto
} from "../../lib/api";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { getQueryErrorMessage, getUserFacingError } from "../../lib/userFacingError";

type Props = NativeStackScreenProps<RootStackParamList, "SettingsExpenseCategories">;

export function ExpenseCategoriesScreen({ route, navigation }: Props) {
  const { farmId } = route.params;
  const { t } = useTranslation();
  useScreenTitle(navigation, t("settings.expenseCategoriesTitle"));
  const scrollPad = useScrollBottomPad();
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");

  const q = useQuery({
    queryKey: ["financeCategories", farmId, activeProfileId],
    queryFn: () => fetchFinanceCategories(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId && clientFeatures.finance)
  });

  const addMut = useMutation({
    mutationFn: () =>
      createFinanceCategory(
        accessToken!,
        farmId,
        {
          type: "expense",
          key: newName.trim().toLowerCase().replace(/\s+/g, "_"),
          name: newName.trim()
        },
        activeProfileId
      ),
    onSuccess: () => {
      setNewName("");
      void qc.invalidateQueries({ queryKey: ["financeCategories", farmId] });
    },
    onError: (e: Error) => Alert.alert(t("common.error"), getUserFacingError(e, t))
  });

  const delMut = useMutation({
    mutationFn: (id: string) =>
      deleteFinanceCategory(accessToken!, farmId, id, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["financeCategories", farmId] });
    },
    onError: (e: Error) => Alert.alert(t("common.error"), getUserFacingError(e, t))
  });

  const expenses =
    q.data?.filter((c: FinanceCategoryDto) => c.type === "expense") ?? [];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: scrollPad }]}
    >
      {q.isPending ? <ActivityIndicator color={mobileColors.accent} /> : null}
      {expenses.map((cat) => (
        <View key={cat.id} style={styles.row}>
          <Text style={styles.name}>{cat.name}</Text>
          {cat.isDefault ? (
            <Text style={styles.badge}>{t("settings.categoryStandard")}</Text>
          ) : (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  t("settings.deleteCategoryTitle"),
                  t("settings.deleteCategoryMessage"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("settings.delete"),
                      style: "destructive",
                      onPress: () => delMut.mutate(cat.id)
                    }
                  ]
                );
              }}
            >
              <Text style={styles.delete}>{t("settings.delete")}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <Text style={styles.addLabel}>{t("settings.addCategory")}</Text>
      <TextInput
        style={styles.input}
        value={newName}
        onChangeText={setNewName}
        placeholder={t("settings.categoryNamePlaceholder")}
        placeholderTextColor={mobileColors.textSecondary}
      />
      <TouchableOpacity
        style={styles.addBtn}
        disabled={!newName.trim() || addMut.isPending}
        onPress={() => addMut.mutate()}
      >
        <Text style={styles.addBtnTx}>{t("settings.addCategoryBtn")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  content: { padding: mobileSpacing.md, gap: mobileSpacing.sm },
  row: {
    backgroundColor: mobileColors.background,
    borderRadius: 12,
    padding: mobileSpacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  name: { ...mobileTypography.body, flex: 1 },
  badge: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  delete: { color: mobileColors.error, fontWeight: "600" },
  addLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.lg
  },
  input: {
    backgroundColor: mobileColors.background,
    borderRadius: 10,
    padding: mobileSpacing.md,
    ...mobileTypography.body
  },
  addBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: 10,
    padding: mobileSpacing.md,
    alignItems: "center"
  },
  addBtnTx: { color: mobileColors.onAccent, fontWeight: "600" }
});
