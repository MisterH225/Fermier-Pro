import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { mobileColors, mobileTypography } from "../../theme/mobileTheme";

export type SettingsRowProps =
  | {
      kind: "navigation";
      label: string;
      value?: string;
      subtitle?: string;
      onPress: () => void;
      isLast?: boolean;
    }
  | {
      kind: "value";
      label: string;
      value: string;
      subtitle?: string;
      isLast?: boolean;
    }
  | {
      kind: "toggle";
      label: string;
      subtitle?: string;
      value: boolean;
      onValueChange: (v: boolean) => void;
      disabled?: boolean;
      isLast?: boolean;
    }
  | {
      kind: "inline_input";
      label: string;
      value: string;
      unit?: string;
      keyboardType?: "default" | "decimal-pad" | "number-pad";
      onChangeText: (t: string) => void;
      onBlur?: () => void;
      isLast?: boolean;
    }
  | {
      kind: "inline_stepper";
      label: string;
      value: number;
      unit?: string;
      min: number;
      max: number;
      onChange: (v: number) => void;
      isLast?: boolean;
    }
  | {
      kind: "button";
      label: string;
      tone?: "default" | "warning" | "danger";
      onPress: () => void;
      isLast?: boolean;
    };

export function SettingsRow(props: SettingsRowProps) {
  const isLast = props.isLast ?? false;

  if (props.kind === "button") {
    const color =
      props.tone === "danger"
        ? mobileColors.error
        : props.tone === "warning"
          ? "#e67e22"
          : mobileColors.accent;
    return (
      <Pressable
        onPress={props.onPress}
        style={({ pressed }) => [
          styles.row,
          !isLast && styles.rowBorder,
          pressed && styles.rowPressed
        ]}
      >
        <Text style={[styles.buttonLabel, { color }]}>{props.label}</Text>
      </Pressable>
    );
  }

  if (props.kind === "value") {
    return (
      <View style={[styles.row, !isLast && styles.rowBorder]}>
        <View style={styles.labelCol}>
          <Text style={styles.label}>{props.label}</Text>
          {props.subtitle ? (
            <Text style={styles.subtitle}>{props.subtitle}</Text>
          ) : null}
        </View>
        <Text style={styles.valueReadonly} numberOfLines={2}>
          {props.value}
        </Text>
      </View>
    );
  }

  if (props.kind === "toggle") {
    return (
      <View style={[styles.row, !isLast && styles.rowBorder]}>
        <View style={styles.labelCol}>
          <Text style={styles.label}>{props.label}</Text>
          {props.subtitle ? (
            <Text style={styles.subtitle}>{props.subtitle}</Text>
          ) : null}
        </View>
        <Switch
          value={props.value}
          onValueChange={props.onValueChange}
          disabled={props.disabled}
          trackColor={{ false: mobileColors.border, true: "#c7ddff" }}
          thumbColor={props.value ? mobileColors.accent : "#f4f4f4"}
        />
      </View>
    );
  }

  if (props.kind === "inline_stepper") {
    const dec = () => props.onChange(Math.max(props.min, props.value - 1));
    const inc = () => props.onChange(Math.min(props.max, props.value + 1));
    return (
      <View style={[styles.row, !isLast && styles.rowBorder]}>
        <Text style={styles.label}>{props.label}</Text>
        <View style={styles.stepper}>
          <Pressable onPress={dec} style={styles.stepBtn} hitSlop={8}>
            <Ionicons name="remove" size={20} color={mobileColors.accent} />
          </Pressable>
          <Text style={styles.stepValue}>
            {props.value}
            {props.unit ? ` ${props.unit}` : ""}
          </Text>
          <Pressable onPress={inc} style={styles.stepBtn} hitSlop={8}>
            <Ionicons name="add" size={20} color={mobileColors.accent} />
          </Pressable>
        </View>
      </View>
    );
  }

  if (props.kind === "inline_input") {
    return (
      <View style={[styles.row, !isLast && styles.rowBorder]}>
        <Text style={[styles.label, styles.inputLabel]}>{props.label}</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={props.value}
            onChangeText={props.onChangeText}
            onBlur={props.onBlur}
            keyboardType={props.keyboardType ?? "decimal-pad"}
            placeholderTextColor={mobileColors.textSecondary}
          />
          {props.unit ? <Text style={styles.unit}>{props.unit}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowBorder,
        pressed && styles.rowPressed
      ]}
    >
      <View style={styles.labelCol}>
        <Text style={styles.label}>{props.label}</Text>
        {props.subtitle ? (
          <Text style={styles.subtitle}>{props.subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.navRight}>
        {props.value ? (
          <Text style={styles.valuePreview} numberOfLines={1}>
            {props.value}
          </Text>
        ) : null}
        <Ionicons
          name="chevron-forward"
          size={18}
          color={mobileColors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    gap: 12
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  rowPressed: {
    backgroundColor: "#f2f2f7"
  },
  labelCol: {
    flex: 1
  },
  label: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  inputLabel: {
    flex: 1,
    marginRight: 8
  },
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  valueReadonly: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    maxWidth: "50%",
    textAlign: "right"
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "55%"
  },
  valuePreview: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "45%"
  },
  input: {
    minWidth: 72,
    textAlign: "right",
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    paddingVertical: 6
  },
  unit: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f2f2f7",
    alignItems: "center",
    justifyContent: "center"
  },
  stepValue: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    minWidth: 64,
    textAlign: "center"
  },
  buttonLabel: {
    ...mobileTypography.body,
    fontWeight: "600",
    textAlign: "center",
    flex: 1
  }
});
