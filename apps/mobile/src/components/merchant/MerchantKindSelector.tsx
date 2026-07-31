import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MerchantKind } from "../../lib/api";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileFontSize, mobileSpacing } from "../../theme/mobileTheme";

const MERCHANT_KINDS: MerchantKind[] = ["standard", "mill"];

type Props = {
  value: MerchantKind;
  onChange: (kind: MerchantKind) => void;
  saving?: boolean;
  testID?: string;
};

/** Chips standard / moulin — profil modal + Paramètres. */
export function MerchantKindSelector({
  value,
  onChange,
  saving = false,
  testID = "merchant-kind-selector"
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.chips}>
        {MERCHANT_KINDS.map((kind) => {
          const active = value === kind;
          return (
            <Pressable
              key={kind}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(kind)}
              disabled={saving || active}
              testID={`${testID}-${kind}`}
            >
              <Text style={[styles.chipTx, active && styles.chipTxActive]}>
                {t(`merchant.profile.kind.${kind}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {saving ? (
        <ActivityIndicator size="small" color={merchantColors.primary} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.sm
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  chip: {
    borderWidth: 1,
    borderColor: merchantColors.border,
    borderRadius: merchantRadius.button,
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    backgroundColor: merchantColors.cardBg
  },
  chipActive: {
    borderColor: merchantColors.primary,
    backgroundColor: merchantColors.primary
  },
  chipTx: {
    color: merchantColors.textPrimary,
    fontWeight: "600",
    fontSize: mobileFontSize.sm
  },
  chipTxActive: {
    color: merchantColors.onPrimary
  }
});
