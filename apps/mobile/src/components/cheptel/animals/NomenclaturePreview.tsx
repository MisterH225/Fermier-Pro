import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  fetchTagCodePreview,
  type AnimalTagPrefixDto
} from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  prefix: AnimalTagPrefixDto;
  count: number;
  enabled?: boolean;
};

export function NomenclaturePreview({
  farmId,
  accessToken,
  activeProfileId,
  prefix,
  count,
  enabled = true
}: Props) {
  const { t } = useTranslation();
  const previewQ = useQuery({
    queryKey: ["nextAnimalNumber", farmId, prefix, count, activeProfileId],
    queryFn: () =>
      fetchTagCodePreview(
        accessToken,
        farmId,
        prefix,
        count,
        activeProfileId
      ),
    enabled: enabled && count >= 1
  });

  if (count < 1) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {previewQ.isPending ? (
        <ActivityIndicator size="small" color={mobileColors.textSecondary} />
      ) : previewQ.data ? (
        <Text style={styles.text}>
          {t("cheptel.animals.bulk.nomenclatureRange", {
            first: previewQ.data.firstTagCode,
            last: previewQ.data.lastTagCode,
            count
          })}
        </Text>
      ) : previewQ.isError ? (
        <Text style={styles.error}>{t("cheptel.animals.bulk.previewError")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  text: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  error: {
    ...mobileTypography.meta,
    color: "#B91C1C"
  }
});
