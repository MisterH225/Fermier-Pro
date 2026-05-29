import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useSession } from "../../context/SessionContext";
import {
  inviteCollaboratorByIdentifier,
  searchCollaboratorByIdentifier,
  type CollaboratorSearchResultDto,
  type CollaboratorSearchUserDto,
  type InvitationPermissions,
  type InvitationRecipientKind
} from "../../lib/api";
import {
  ALL_PERMISSION_KEYS,
  type PermissionKey
} from "../../lib/memberPermissions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { BaseModal } from "./BaseModal";
import { SuccessModal } from "./SuccessModal";

type Props = {
  visible: boolean;
  farmId: string | null;
  onClose: () => void;
};

type RecipientOption = {
  key: InvitationRecipientKind;
  icon: keyof typeof Ionicons.glyphMap;
};

const RECIPIENT_OPTIONS: RecipientOption[] = [
  { key: "veterinarian", icon: "medkit-outline" },
  { key: "technician", icon: "construct-outline" },
  { key: "partner", icon: "people-outline" }
];

function defaultPermissionsFor(
  kind: InvitationRecipientKind
): InvitationPermissions {
  switch (kind) {
    case "veterinarian":
      return { readOnly: true, dataEntry: true, health: true };
    case "technician":
      return { readOnly: true, dataEntry: true };
    default:
      return { readOnly: true };
  }
}

function isLikelyEmail(value: string): boolean {
  return value.includes("@");
}

function isMinValid(value: string): boolean {
  return value.trim().length >= 8;
}

export function SearchCollaboratorModal({ visible, farmId, onClose }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();

  const [identifier, setIdentifier] = useState("");
  const [searchResult, setSearchResult] =
    useState<CollaboratorSearchResultDto | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [step, setStep] = useState<"search" | "configure">("search");
  const [recipient, setRecipient] = useState<CollaboratorSearchUserDto | null>(
    null
  );
  const [recipientKind, setRecipientKind] =
    useState<InvitationRecipientKind>("technician");
  const [permissions, setPermissions] = useState<InvitationPermissions>(
    defaultPermissionsFor("technician")
  );
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<{ name: string } | null>(null);

  const canSearch = isMinValid(identifier);

  const resetAll = () => {
    setIdentifier("");
    setSearchResult(null);
    setSearchError(null);
    setStep("search");
    setRecipient(null);
    setRecipientKind("technician");
    setPermissions(defaultPermissionsFor("technician"));
    setMessage("");
    setSuccess(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const searchMut = useMutation({
    mutationFn: async () => {
      if (!farmId) {
        throw new Error("farmId requis");
      }
      return searchCollaboratorByIdentifier(
        accessToken,
        farmId,
        identifier.trim(),
        activeProfileId
      );
    },
    onSuccess: (data) => {
      setSearchResult(data);
      setSearchError(null);
    },
    onError: (err: Error) => {
      setSearchError(err.message);
      setSearchResult(null);
    }
  });

  const inviteMut = useMutation({
    mutationFn: async () => {
      if (!farmId || !recipient) throw new Error("missing");
      return inviteCollaboratorByIdentifier(
        accessToken,
        farmId,
        {
          userId: recipient.userId,
          recipientKind,
          permissions,
          message: message.trim() || undefined
        },
        activeProfileId
      );
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({
        queryKey: ["farmPendingInvitations", farmId]
      });
      setSuccess({
        name:
          res.recipientFirstName || recipient?.displayName.split(" ")[0] || ""
      });
    },
    onError: (err: Error) => {
      Alert.alert("", err.message);
    }
  });

  const availableRecipientKinds = useMemo(() => {
    if (!recipient) return RECIPIENT_OPTIONS;
    return RECIPIENT_OPTIONS.filter((opt) => {
      if (opt.key === "veterinarian") {
        return recipient.vetVerified;
      }
      return true;
    });
  }, [recipient]);

  const onPickRecipientKind = (kind: InvitationRecipientKind) => {
    setRecipientKind(kind);
    setPermissions(defaultPermissionsFor(kind));
  };

  const onTogglePermission = (key: PermissionKey) => {
    setPermissions((prev) => {
      const next: InvitationPermissions = { ...prev, [key]: !prev[key] };
      const hasOther =
        Boolean(next.dataEntry) ||
        Boolean(next.health) ||
        Boolean(next.finance);
      if (!hasOther) next.readOnly = true;
      return next;
    });
  };

  const proceedToConfigure = (user: CollaboratorSearchUserDto) => {
    setRecipient(user);
    const initialKind: InvitationRecipientKind = user.vetVerified
      ? "veterinarian"
      : "technician";
    setRecipientKind(initialKind);
    setPermissions(defaultPermissionsFor(initialKind));
    setStep("configure");
  };

  return (
    <>
      <BaseModal
        visible={visible && !success}
        title={
          step === "search"
            ? t("collab.searchByIdentifier.title")
            : t("collab.searchByIdentifier.configureTitle")
        }
        onClose={handleClose}
        confirmLabel={
          step === "configure"
            ? t("collab.searchByIdentifier.sendInvite")
            : undefined
        }
        onConfirm={
          step === "configure" ? () => inviteMut.mutate() : undefined
        }
        confirmLoading={inviteMut.isPending}
        confirmDisabled={!recipient || inviteMut.isPending}
      >
        {step === "search" ? (
          <View>
            <Text style={styles.label}>
              {t("collab.searchByIdentifier.fieldLabel")}
            </Text>
            <TextInput
              value={identifier}
              onChangeText={(v) => {
                setIdentifier(v);
                setSearchResult(null);
                setSearchError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={
                isLikelyEmail(identifier) ? "email-address" : "phone-pad"
              }
              placeholder={t("collab.searchByIdentifier.placeholder")}
              placeholderTextColor={mobileColors.textSecondary}
              style={styles.input}
              accessibilityLabel={t("collab.searchByIdentifier.fieldLabel")}
            />
            <Text style={styles.hint}>
              {t("collab.searchByIdentifier.hint")}
            </Text>

            <Pressable
              onPress={() => searchMut.mutate()}
              disabled={!canSearch || searchMut.isPending}
              style={[
                styles.primaryBtn,
                (!canSearch || searchMut.isPending) && styles.primaryBtnOff
              ]}
              accessibilityRole="button"
            >
              {searchMut.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnTxt}>
                  {t("collab.searchByIdentifier.searchAction")}
                </Text>
              )}
            </Pressable>

            {searchError ? (
              <Text style={styles.errorTxt}>{searchError}</Text>
            ) : null}

            {searchResult ? (
              <View style={styles.resultArea}>
                {searchResult.status === "not_found" ? (
                  <View style={styles.notFoundCard}>
                    <Ionicons
                      name="information-circle-outline"
                      size={28}
                      color={mobileColors.textSecondary}
                    />
                    <Text style={styles.notFoundTxt}>
                      {t("collab.searchByIdentifier.notFound")}
                    </Text>
                  </View>
                ) : null}

                {searchResult.status === "self" ? (
                  <View style={styles.notFoundCard}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={28}
                      color={mobileColors.error}
                    />
                    <Text style={styles.notFoundTxt}>
                      {t("collab.searchByIdentifier.selfSearch")}
                    </Text>
                  </View>
                ) : null}

                {searchResult.status === "already_member" ? (
                  <ResultCard
                    user={searchResult.user}
                    disabled
                    badgeLabel={t(
                      "collab.searchByIdentifier.alreadyMemberBadge"
                    )}
                    footerHint={t("collab.searchByIdentifier.alreadyMember")}
                  />
                ) : null}

                {searchResult.status === "already_invited" ? (
                  <ResultCard
                    user={searchResult.user}
                    disabled
                    badgeLabel={t(
                      "collab.searchByIdentifier.alreadyInvitedBadge"
                    )}
                    footerHint={t("collab.searchByIdentifier.alreadyInvited")}
                  />
                ) : null}

                {searchResult.status === "found" ? (
                  <ResultCard
                    user={searchResult.user}
                    onPress={() => proceedToConfigure(searchResult.user)}
                    cta={t("collab.searchByIdentifier.inviteCta")}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View>
            {recipient ? (
              <View style={styles.previewCard}>
                <Avatar
                  url={recipient.avatarUrl}
                  displayName={recipient.displayName}
                />
                <View style={styles.previewTexts}>
                  <Text style={styles.previewName}>
                    {recipient.displayName || recipient.maskedIdentifier}
                  </Text>
                  <Text style={styles.previewSub}>
                    {recipient.maskedIdentifier}
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={[styles.label, styles.labelGap]}>
              {t("collab.fieldRecipient")}
            </Text>
            <View style={styles.recipientGrid}>
              {availableRecipientKinds.map((opt) => {
                const selected = opt.key === recipientKind;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => onPickRecipientKind(opt.key)}
                    style={[
                      styles.recipientCard,
                      selected && styles.recipientCardOn
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t(`collab.recipientKinds.${opt.key}`)}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={26}
                      color={
                        selected
                          ? mobileColors.accent
                          : mobileColors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.recipientLabel,
                        selected && styles.recipientLabelOn
                      ]}
                    >
                      {t(`collab.recipientKinds.${opt.key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, styles.labelGap]}>
              {t("collab.fieldPermissions")}
            </Text>
            <Text style={styles.hint}>{t("collab.permissionsHint")}</Text>
            <View style={styles.permList}>
              {ALL_PERMISSION_KEYS.map((key) => {
                const on = Boolean(permissions[key]);
                return (
                  <Pressable
                    key={key}
                    onPress={() => onTogglePermission(key)}
                    style={[styles.permRow, on && styles.permRowOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <View style={[styles.permTick, on && styles.permTickOn]}>
                      {on ? (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      ) : null}
                    </View>
                    <View style={styles.permTexts}>
                      <Text style={styles.permTitle}>
                        {t(`collab.permissionKinds.${key}`)}
                      </Text>
                      <Text style={styles.permSub}>
                        {t(`collab.permissionHints.${key}`)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, styles.labelGap]}>
              {t("collab.searchByIdentifier.messageLabel")}
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={t("collab.searchByIdentifier.messagePlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              style={[styles.input, styles.messageInput]}
              multiline
              maxLength={500}
            />
          </View>
        )}
      </BaseModal>

      <SuccessModal
        visible={Boolean(success)}
        message={t("collab.searchByIdentifier.successMsg", {
          name: success?.name ?? ""
        })}
        onClose={handleClose}
      />
    </>
  );
}

function Avatar({
  url,
  displayName
}: {
  url: string | null;
  displayName: string;
}) {
  if (url) {
    return <Image source={{ uri: url }} style={styles.avatar} />;
  }
  const initials = displayName
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitials}>{initials || "?"}</Text>
    </View>
  );
}

function ResultCard({
  user,
  disabled,
  badgeLabel,
  onPress,
  cta,
  footerHint
}: {
  user: CollaboratorSearchUserDto;
  disabled?: boolean;
  badgeLabel?: string;
  onPress?: () => void;
  cta?: string;
  footerHint?: string;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[styles.resultCard, disabled && styles.resultCardDisabled]}
      accessibilityRole="button"
    >
      <View style={styles.resultHeader}>
        <Avatar url={user.avatarUrl} displayName={user.displayName} />
        <View style={styles.resultTexts}>
          <View style={styles.nameRow}>
            <Text style={styles.resultName} numberOfLines={1}>
              {user.displayName || user.maskedIdentifier}
            </Text>
            {user.vetVerified ? (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={mobileColors.success}
                style={{ marginLeft: 4 }}
              />
            ) : null}
          </View>
          <Text style={styles.resultSub}>{user.maskedIdentifier}</Text>
          {user.profileTypes.length > 0 ? (
            <View style={styles.profileChipsRow}>
              {user.profileTypes.map((p) => (
                <View key={p} style={styles.profileChip}>
                  <Text style={styles.profileChipTxt}>
                    {t(`collab.profileTypes.${p}`, { defaultValue: p })}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {badgeLabel ? (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeTxt}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
      {footerHint ? (
        <Text style={styles.resultFooterHint}>{footerHint}</Text>
      ) : null}
      {cta && !disabled ? (
        <View style={styles.resultCta}>
          <Text style={styles.resultCtaTxt}>{cta}</Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={mobileColors.accent}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: mobileSpacing.sm
  },
  labelGap: {
    marginTop: mobileSpacing.xl
  },
  input: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm + 2,
    backgroundColor: mobileColors.surfaceMuted
  },
  messageInput: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  hint: {
    ...mobileTypography.meta,
    fontSize: 12,
    lineHeight: 17,
    color: mobileColors.textSecondary,
    marginTop: 6,
    marginBottom: mobileSpacing.md
  },
  primaryBtn: {
    marginTop: mobileSpacing.sm,
    backgroundColor: mobileColors.accent,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryBtnOff: {
    opacity: 0.4
  },
  primaryBtnTxt: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "700"
  },
  errorTxt: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    marginTop: mobileSpacing.sm
  },
  resultArea: {
    marginTop: mobileSpacing.lg
  },
  notFoundCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  notFoundTxt: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    flex: 1,
    lineHeight: 20
  },
  resultCard: {
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.surfaceMuted
  },
  resultCardDisabled: {
    opacity: 0.55
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22
  },
  avatarFallback: {
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarInitials: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  resultTexts: {
    flex: 1
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  resultName: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    flexShrink: 1
  },
  resultSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  profileChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6
  },
  profileChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.accentSoft
  },
  profileChipTxt: {
    ...mobileTypography.meta,
    fontSize: 11,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.border
  },
  statusBadgeTxt: {
    ...mobileTypography.meta,
    fontSize: 11,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  resultFooterHint: {
    ...mobileTypography.meta,
    fontSize: 12,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  resultCta: {
    marginTop: mobileSpacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4
  },
  resultCtaTxt: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft
  },
  previewTexts: { flex: 1 },
  previewName: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "700"
  },
  previewSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  recipientGrid: {
    flexDirection: "row",
    gap: mobileSpacing.sm
  },
  recipientCard: {
    flex: 1,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.surfaceMuted,
    minHeight: 92,
    gap: 6
  },
  recipientCardOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  recipientLabel: {
    ...mobileTypography.body,
    fontSize: 12,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  recipientLabelOn: {
    color: mobileColors.accent,
    fontWeight: "600"
  },
  permList: { gap: mobileSpacing.xs },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.surfaceMuted
  },
  permRowOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  permTick: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background,
    marginRight: mobileSpacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  permTickOn: {
    backgroundColor: mobileColors.accent,
    borderColor: mobileColors.accent
  },
  permTexts: { flex: 1 },
  permTitle: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  permSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  }
});
