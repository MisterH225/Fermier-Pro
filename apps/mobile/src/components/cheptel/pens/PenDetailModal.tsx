import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../../modals/BaseModal";
import { EventList, type EventItem } from "../../lists";
import type { CheptelPenRowDto, PenDetailDto } from "../../../lib/api";
import { mobileColors, mobileSpacing, mobileTypography } from "../../../theme/mobileTheme";

type Props = {
  visible: boolean;
  pen: CheptelPenRowDto | null;
  detail: PenDetailDto | undefined;
  isLoading: boolean;
  onClose: () => void;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
};

export function PenDetailModal({
  visible,
  pen,
  detail,
  isLoading,
  onClose
}: Props) {
  const { t } = useTranslation();
  if (!pen) {
    return null;
  }

  const placementEvents: EventItem[] = (detail?.placements ?? []).map((pl) => {
    const label =
      pl.animal?.tagCode ??
      pl.batch?.name ??
      pl.animal?.publicId?.slice(0, 8) ??
      "—";
    return {
      id: pl.id,
      title: label,
      subtitle: pl.batch ? `${pl.batch.headcount} têtes` : undefined,
      valueType: "neutral",
      date: new Date(pl.startedAt).toLocaleDateString("fr-FR"),
      iconType: "in"
    };
  });

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={`${pen.name} · ${pen.barnName}`}
    >
      <Text style={styles.meta}>
        {t("cheptel.pens.capacityLine", {
          occ: pen.occupancy,
          cap: pen.capacity
        })}
      </Text>
      {isLoading ? (
        <ActivityIndicator color={mobileColors.accent} style={{ marginVertical: 16 }} />
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("cheptel.pens.animalsInPen")}</Text>
          <EventList
            layout="embedded"
            data={placementEvents}
            emptyMessage={t("cheptel.pens.noAnimals")}
            pageSize={20}
          />
        </View>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginBottom: mobileSpacing.md },
  section: { marginTop: mobileSpacing.sm },
  sectionTitle: { ...mobileTypography.body, fontWeight: "700", marginBottom: mobileSpacing.sm }
});
