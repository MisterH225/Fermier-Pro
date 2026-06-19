import { useTranslation } from "react-i18next";
import { Image, StyleSheet, Text, View } from "react-native";
import type { TechnicianProfileDto } from "../../lib/api";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import { SecondaryButton } from "../ui/SecondaryButton";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
type Props = {
  visible: boolean;
  tech: TechnicianProfileDto | null;
  onClose: () => void;
  onMessage: () => void;
  onInvite?: () => void;
};

export function TechnicianPublicProfileModal({
  visible,
  tech,
  onClose,
  onMessage,
  onInvite
}: Props) {
  const { t } = useTranslation();

  if (!tech) {
    return null;
  }

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={tech.displayName ?? t("collab.directory.techTitle")}
      footerPrimary={
        <View style={styles.actions}>
          <PrimaryButton
            label={t("collab.directory.message")}
            onPress={() => {
              onMessage();
              onClose();
            }}
          />
          {onInvite ? (
            <SecondaryButton
              label={t("collab.directory.invite")}
              onPress={onInvite}
            />
          ) : null}
        </View>
      }
    >
      <View style={styles.hero}>
        {tech.profilePhotoUrl ? (
          <Image source={{ uri: tech.profilePhotoUrl }} style={styles.photo} />
        ) : (
          <View style={styles.photoPh}>
            <Text style={styles.photoTx}>👷</Text>
          </View>
        )}
        <View style={styles.heroBody}>
          <Text
            style={[
              styles.avail,
              tech.isAvailable ? styles.availOk : styles.availOff
            ]}
          >
            {tech.isAvailable
              ? t("collab.directory.available")
              : t("collab.directory.unavailable")}
          </Text>
          {tech.locationLabel ? (
            <Text style={styles.loc}>📍 {tech.locationLabel}</Text>
          ) : null}
        </View>
      </View>

      <Section title={t("collab.directory.experience")}>
        {tech.formationTypeLabel ? (
          <Text style={styles.line}>
            🎓 {tech.formationTypeLabel}
            {tech.formationDetails ? ` — ${tech.formationDetails}` : ""}
          </Text>
        ) : null}
        {tech.experienceYearsCount != null ? (
          <Text style={styles.line}>
            {t("collab.directory.yearsExp", {
              count: tech.experienceYearsCount
            })}
          </Text>
        ) : null}
        <View style={styles.pills}>
          {tech.specializations.map((s) => (
            <View key={s} style={styles.pill}>
              <Text style={styles.pillTx}>{s}</Text>
            </View>
          ))}
        </View>
      </Section>

      {(tech.availabilityNote || tech.pretensionSalarialeMensuelle != null) && (
        <Section title={t("collab.directory.availabilitySection")}>
          {tech.availabilityNote ? (
            <Text style={styles.line}>{tech.availabilityNote}</Text>
          ) : null}
          {tech.pretensionSalarialeMensuelle != null ? (
            <Text style={styles.pretension}>
              {t("collab.directory.pretension")}:{" "}
              {Math.round(tech.pretensionSalarialeMensuelle).toLocaleString(
                "fr-FR"
              )}{" "}
              {tech.pretensionCurrency}/mois
            </Text>
          ) : null}
        </Section>
      )}

      {tech.bio?.trim() ? (
        <Section title={t("collab.directory.bio")}>
          <Text style={styles.bio}>{tech.bio.trim()}</Text>
        </Section>
      ) : null}
    </BaseModal>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    gap: mobileSpacing.md,
    marginBottom: mobileSpacing.lg
  },
  photo: { width: 72, height: 72, borderRadius: 36 },
  photoPh: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  photoTx: { fontSize: 32 },
  heroBody: { flex: 1, justifyContent: "center", gap: 4 },
  avail: { fontWeight: "800", fontSize: 14 },
  availOk: { color: "#166534" },
  availOff: { color: mobileColors.textSecondary },
  loc: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  section: { marginBottom: mobileSpacing.lg },
  sectionTitle: {
    ...mobileTypography.meta,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: mobileSpacing.sm,
    color: mobileColors.textSecondary
  },
  line: { ...mobileTypography.body, marginBottom: 6 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  pill: {
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  pillTx: { fontSize: 12, fontWeight: "600", color: mobileColors.accent },
  pretension: { fontWeight: "700", color: mobileColors.textPrimary },
  bio: { ...mobileTypography.body, lineHeight: 22 },
  actions: { gap: mobileSpacing.sm, width: "100%" }
});
