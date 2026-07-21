import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type {
  ProfileDeactivationBlockDto,
  ProfileDeactivationPreviewDto,
  ProfileTypeChoice
} from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";

function normalizeConfirmInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

type Props = {
  visible: boolean;
  loading: boolean;
  submitting: boolean;
  preview: ProfileDeactivationPreviewDto | null;
  profileType: ProfileTypeChoice;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onResolveBlock?: (hint: string) => void;
};

export function ProfileDeactivationSheet({
  visible,
  loading,
  submitting,
  preview,
  profileType,
  errorMessage,
  onClose,
  onConfirm,
  onResolveBlock
}: Props) {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState("");

  const profileLabel = t(`account.profileTypes.${profileType}`);
  const expectedWord = normalizeConfirmInput(profileLabel);

  const canConfirm = useMemo(() => {
    if (!preview?.canDeactivate || submitting) {
      return false;
    }
    return normalizeConfirmInput(confirmText) === expectedWord;
  }, [confirmText, expectedWord, preview?.canDeactivate, submitting]);

  useEffect(() => {
    if (!visible) {
      setConfirmText("");
    }
  }, [visible]);

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  const willHide = t(`account.sensitiveZone.effects.${profileType}.willHide`, {
    returnObjects: true
  }) as string[];
  const willKeep = t(`account.sensitiveZone.effects.${profileType}.willKeep`, {
    returnObjects: true
  }) as string[];

  const blockMessage = (block: ProfileDeactivationBlockDto): string => {
    const key = `account.sensitiveZone.blocks.${block.code}`;
    if (t(key) !== key) {
      return t(key, { count: block.count ?? 0 });
    }
    return block.message;
  };

  const resolveLabel = (hint: string): string => {
    const key = `account.sensitiveZone.resolveHints.${hint.replace(/\//g, ".")}`;
    const label = t(key);
    return label !== key ? label : t("account.sensitiveZone.resolveGeneric");
  };

  return (
    <BaseModal
      visible={visible}
      onClose={handleClose}
      title={t("account.sensitiveZone.sheetTitle")}
      footerPrimary={
        preview?.canDeactivate ? (
          <Pressable
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnOff]}
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            accessibilityLabel={t("account.sensitiveZone.confirmAction")}
          >
            {submitting ? (
              <ActivityIndicator color={mobileColors.background} />
            ) : (
              <Text style={styles.confirmTx}>
                {t("account.sensitiveZone.confirmAction")}
              </Text>
            )}
          </Pressable>
        ) : undefined
      }
      secondaryActions={[
        {
          key: "cancel",
          icon: "close-outline",
          label: t("account.sensitiveZone.cancel"),
          onPress: handleClose
        }
      ]}
    >
      {loading || !preview ? (
        <ModalSection>
          <ActivityIndicator color={mobileColors.accent} />
          <Text style={styles.loadingTx}>
            {t("account.sensitiveZone.loadingPreview")}
          </Text>
        </ModalSection>
      ) : (
        <>
          {preview.blocks.length > 0 ? (
            <ModalSection title={t("account.sensitiveZone.blocksTitle")}>
              {preview.blocks.map((block) => (
                <View key={block.code} style={styles.blockRow}>
                  <Text style={styles.blockTx}>{blockMessage(block)}</Text>
                  {block.resolveHint && onResolveBlock ? (
                    <Pressable
                      onPress={() => onResolveBlock(block.resolveHint!)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.resolveLink}>
                        {resolveLabel(block.resolveHint)}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {preview.blocks.some(
                (b) => b.code === "LAST_ACTIVE_PROFILE"
              ) ? (
                <Text style={styles.lastProfileHint}>
                  {t("account.sensitiveZone.lastProfileHint")}
                </Text>
              ) : null}
            </ModalSection>
          ) : null}

          <ModalSection title={t("account.sensitiveZone.willHideTitle")}>
            {(Array.isArray(willHide) ? willHide : []).map((line) => (
              <Text key={line} style={styles.effectHide}>
                • {line}
              </Text>
            ))}
          </ModalSection>

          <ModalSection title={t("account.sensitiveZone.willKeepTitle")}>
            {(Array.isArray(willKeep) ? willKeep : []).map((line) => (
              <Text key={line} style={styles.effectKeep}>
                • {line}
              </Text>
            ))}
          </ModalSection>

          {preview.canDeactivate ? (
            <ModalSection>
              <Text style={styles.confirmMsg}>
                {t("account.sensitiveZone.confirmMessage", {
                  profileType: profileLabel
                })}
              </Text>
              <TextInput
                style={styles.input}
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder={t("account.sensitiveZone.confirmPlaceholder", {
                  profileType: profileLabel
                })}
                placeholderTextColor={mobileColors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />
            </ModalSection>
          ) : null}

          {errorMessage ? (
            <Text style={styles.errorTx}>{errorMessage}</Text>
          ) : null}
        </>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  loadingTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: mobileSpacing.sm
  },
  blockRow: {
    marginBottom: mobileSpacing.sm,
    gap: 4
  },
  blockTx: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md,
    color: mobileColors.error,
    lineHeight: 20
  },
  resolveLink: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  lastProfileHint: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm,
    lineHeight: 18
  },
  effectHide: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    marginBottom: 4,
    lineHeight: 20
  },
  effectKeep: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary,
    marginBottom: 4,
    lineHeight: 20
  },
  confirmMsg: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    lineHeight: 22,
    marginBottom: mobileSpacing.md
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 12,
    fontSize: mobileFontSize.lg,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.background
  },
  confirmBtn: {
    backgroundColor: mobileColors.error,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  confirmBtnOff: {
    opacity: 0.45
  },
  confirmTx: {
    color: mobileColors.background,
    fontWeight: "700",
    fontSize: mobileFontSize.lg
  },
  errorTx: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    marginTop: mobileSpacing.sm,
    marginHorizontal: mobileSpacing.md,
    lineHeight: 18
  }
});
