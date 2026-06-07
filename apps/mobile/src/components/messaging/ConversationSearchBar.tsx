import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  accentColor?: string;
};

export function ConversationSearchBar({
  value,
  onChangeText,
  placeholder = "Rechercher une conversation…",
  accentColor = mobileColors.accent
}: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={18} color={mobileColors.textSecondary} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={mobileColors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Effacer la recherche"
        >
          <Ionicons name="close-circle" size={18} color={accentColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginHorizontal: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  input: {
    flex: 1,
    ...mobileTypography.body,
    fontSize: 15,
    color: mobileColors.textPrimary,
    padding: 0
  }
});
