import {
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  View
} from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type AppTextFieldProps = TextInputProps & {
  label?: string;
  helper?: string | null;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
};

export function AppTextField({
  label,
  helper,
  error,
  containerStyle,
  style,
  placeholderTextColor,
  multiline,
  ...inputProps
}: AppTextFieldProps) {
  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={
          placeholderTextColor ?? mobileColors.textSecondary
        }
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          error ? styles.inputError : null,
          style
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.background
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  inputError: {
    borderColor: mobileColors.error
  },
  helper: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs
  },
  error: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    marginTop: mobileSpacing.xs
  }
});
