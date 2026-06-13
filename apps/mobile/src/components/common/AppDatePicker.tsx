import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useAppDatePreferences } from "../../hooks/useAppDatePreferences";
import {
  clampDate,
  fromIsoDateString,
  fromIsoDateTimeString,
  monthYearToDate,
  roundToMinuteInterval,
  startOfDay,
  toIsoDateString,
  toIsoDateTimeString
} from "../../lib/appDate";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";

export type AppDatePickerMode = "date" | "datetime" | "month_year";

export type AppDatePickerProps = {
  value?: Date | null;
  onChange?: (date: Date) => void;
  /** Valeur ISO `YYYY-MM-DD` ou datetime ISO — simplifie la migration. */
  isoValue?: string;
  onIsoChange?: (iso: string) => void;
  mode?: AppDatePickerMode;
  label?: string;
  placeholder?: string;
  required?: boolean;
  minDate?: Date | null;
  maxDate?: Date | null;
  disabled?: boolean;
  helper?: string | null;
  error?: string | null;
  farmId?: string;
};

function resolveValue(
  mode: AppDatePickerMode,
  value?: Date | null,
  isoValue?: string
): Date | null {
  if (value != null) {
    return value;
  }
  if (!isoValue?.trim()) {
    return null;
  }
  if (mode === "datetime") {
    return fromIsoDateTimeString(isoValue);
  }
  if (mode === "month_year") {
    const m = /^(\d{4})-(\d{2})/.exec(isoValue.trim());
    if (!m) {
      return null;
    }
    return monthYearToDate(Number(m[1]), Number(m[2]));
  }
  return fromIsoDateString(isoValue);
}

function emitChange(
  mode: AppDatePickerMode,
  date: Date,
  onChange?: (d: Date) => void,
  onIsoChange?: (iso: string) => void
) {
  onChange?.(date);
  if (onIsoChange) {
    if (mode === "datetime") {
      onIsoChange(toIsoDateTimeString(date));
    } else if (mode === "month_year") {
      onIsoChange(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      );
    } else {
      onIsoChange(toIsoDateString(date));
    }
  }
}

function MonthYearSpinner({
  draft,
  onChange,
  locale
}: {
  draft: Date;
  onChange: (d: Date) => void;
  locale: "fr" | "en";
}) {
  const { t } = useTranslation();
  const months =
    locale === "en"
      ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : [
          "Janv.",
          "Févr.",
          "Mars",
          "Avr.",
          "Mai",
          "Juin",
          "Juil.",
          "Août",
          "Sept.",
          "Oct.",
          "Nov.",
          "Déc."
        ];
  const year = draft.getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => year - 10 + i);

  return (
    <View style={pickerStyles.monthYearWrap}>
      <Text style={pickerStyles.monthYearLabel}>{t("datePicker.month")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={pickerStyles.pillRow}>
          {months.map((lab, idx) => {
            const active = draft.getMonth() === idx;
            return (
              <Pressable
                key={lab}
                onPress={() => onChange(monthYearToDate(year, idx + 1))}
                style={[pickerStyles.pill, active && pickerStyles.pillOn]}
              >
                <Text
                  style={[pickerStyles.pillTx, active && pickerStyles.pillTxOn]}
                >
                  {lab}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Text style={pickerStyles.monthYearLabel}>{t("datePicker.year")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={pickerStyles.pillRow}>
          {years.map((y) => {
            const active = y === year;
            return (
              <Pressable
                key={y}
                onPress={() => onChange(monthYearToDate(y, draft.getMonth() + 1))}
                style={[pickerStyles.pill, active && pickerStyles.pillOn]}
              >
                <Text
                  style={[pickerStyles.pillTx, active && pickerStyles.pillTxOn]}
                >
                  {y}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export function AppDatePicker({
  value,
  onChange,
  isoValue,
  onIsoChange,
  mode = "date",
  label,
  placeholder,
  required = false,
  minDate = null,
  maxDate = null,
  disabled = false,
  helper = null,
  error = null,
  farmId
}: AppDatePickerProps) {
  const { t } = useTranslation();
  const prefs = useAppDatePreferences(farmId);
  const [open, setOpen] = useState(false);

  const valueMs = value?.getTime() ?? null;

  const resolvedMs = useMemo(() => {
    if (valueMs != null) {
      return valueMs;
    }
    const d = resolveValue(mode, null, isoValue);
    return d?.getTime() ?? null;
  }, [mode, valueMs, isoValue]);

  const defaultDraft = useMemo(() => {
    const n = new Date();
    return mode === "datetime" ? n : startOfDay(n);
  }, [mode]);

  const pickDraft = (ms: number | null) =>
    ms != null ? new Date(ms) : defaultDraft;

  const [draft, setDraft] = useState<Date>(() => pickDraft(resolvedMs));
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(pickDraft(resolvedMs));
    }
    if (!open && wasOpenRef.current && resolvedMs != null) {
      setDraft(new Date(resolvedMs));
    }
    wasOpenRef.current = open;
  }, [open, resolvedMs, defaultDraft, mode]);

  const displayText = useMemo(() => {
    if (resolvedMs == null) {
      return "";
    }
    const d = new Date(resolvedMs);
    if (mode === "datetime") {
      return prefs.formatDateTime(d);
    }
    if (mode === "month_year") {
      return prefs.formatMonthYear(d);
    }
    return prefs.formatDate(d);
  }, [resolvedMs, mode, prefs]);

  const placeholderText =
    placeholder ?? t("datePicker.placeholder");

  const applyShortcut = (d: Date) => {
    let next = mode === "datetime" ? d : startOfDay(d);
    if (mode === "datetime") {
      next = roundToMinuteInterval(next, 15);
    }
    next = clampDate(next, minDate, maxDate);
    setDraft(next);
  };

  const shortcuts = useMemo(() => {
    if (mode === "datetime") {
      const now = new Date();
      const morning = new Date(now);
      morning.setHours(8, 0, 0, 0);
      const afternoon = new Date(now);
      afternoon.setHours(14, 0, 0, 0);
      return [
        { label: t("datePicker.now"), date: now },
        { label: t("datePicker.morning8"), date: morning },
        { label: t("datePicker.afternoon14"), date: afternoon }
      ];
    }
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const week = new Date(today);
    week.setDate(week.getDate() - 7);
    return [
      { label: t("datePicker.today"), date: today },
      { label: t("datePicker.yesterday"), date: yesterday },
      { label: t("datePicker.daysAgo7"), date: week }
    ];
  }, [mode, t]);

  const confirm = () => {
    let next = draft;
    if (mode === "datetime") {
      next = roundToMinuteInterval(next, 15);
    } else if (mode === "date" || mode === "month_year") {
      next = startOfDay(next);
    }
    next = clampDate(next, minDate, maxDate);
    emitChange(mode, next, onChange, onIsoChange);
    setOpen(false);
  };

  const pickerMode = mode === "datetime" ? "datetime" : "date";

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required && resolvedMs == null ? (
            <Text style={styles.required}> *</Text>
          ) : null}
        </Text>
      ) : null}

      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.trigger,
          resolvedMs != null && styles.triggerFilled,
          disabled && styles.triggerDisabled,
          error && styles.triggerError,
          pressed && !disabled && styles.triggerPressed
        ]}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholderText}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={disabled ? mobileColors.textSecondary : mobileColors.accent}
        />
        <Text
          style={[
            styles.triggerText,
            resolvedMs == null && styles.triggerPlaceholder,
            disabled && styles.triggerTextDisabled
          ]}
          numberOfLines={1}
        >
          {displayText || placeholderText}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={mobileColors.textSecondary}
        />
      </Pressable>

      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <BaseModal
        visible={open}
        onClose={() => setOpen(false)}
        title={t("datePicker.title")}
        footerPrimary={
          <View style={pickerStyles.footerRow}>
            <Pressable onPress={() => setOpen(false)} style={pickerStyles.footerBtn}>
              <Text style={pickerStyles.cancelTx}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable onPress={confirm} style={pickerStyles.confirmBtn}>
              <Text style={pickerStyles.confirmTx}>{t("datePicker.confirm")}</Text>
            </Pressable>
          </View>
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={pickerStyles.shortcutScroll}
        >
          <View style={pickerStyles.pillRow}>
            {shortcuts.map((s) => (
              <Pressable
                key={s.label}
                onPress={() => applyShortcut(s.date)}
                style={pickerStyles.pillOutline}
              >
                <Text style={pickerStyles.pillOutlineTx}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {mode === "month_year" ? (
          <MonthYearSpinner
            draft={draft}
            onChange={setDraft}
            locale={prefs.locale}
          />
        ) : open ? (
          <View style={pickerStyles.pickerWrap}>
            <DateTimePicker
              value={draft}
              mode={pickerMode}
              display="spinner"
              onChange={(event, selectedDate) => {
                if (
                  Platform.OS === "android" &&
                  event.type === "dismissed"
                ) {
                  return;
                }
                if (!selectedDate) {
                  return;
                }
                setDraft((prev) =>
                  prev.getTime() === selectedDate.getTime()
                    ? prev
                    : selectedDate
                );
              }}
              minimumDate={minDate ?? undefined}
              maximumDate={maxDate ?? undefined}
              locale={prefs.pickerLocale}
              {...(Platform.OS === "ios" && pickerMode === "datetime"
                ? { minuteInterval: 15 }
                : {})}
            />
          </View>
        ) : null}
      </BaseModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.xs },
  label: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  required: { color: mobileColors.error },
  trigger: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  triggerFilled: {
    backgroundColor: mobileColors.accentSoft,
    borderColor: mobileColors.accent
  },
  triggerDisabled: {
    opacity: 0.55
  },
  triggerError: {
    borderColor: mobileColors.error
  },
  triggerPressed: {
    opacity: 0.85
  },
  triggerText: {
    flex: 1,
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  triggerPlaceholder: {
    color: mobileColors.textSecondary,
    fontWeight: "400"
  },
  triggerTextDisabled: {
    color: mobileColors.textSecondary
  },
  helper: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  error: {
    ...mobileTypography.meta,
    color: mobileColors.error
  }
});

const pickerStyles = StyleSheet.create({
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.md
  },
  footerBtn: { paddingVertical: mobileSpacing.sm },
  cancelTx: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  confirmTx: {
    ...mobileTypography.body,
    color: mobileColors.onAccent,
    fontWeight: "700"
  },
  shortcutScroll: { marginBottom: mobileSpacing.sm },
  pillRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xs
  },
  pillOutline: {
    borderWidth: 1,
    borderColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs
  },
  pillOutlineTx: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  pickerWrap: { alignItems: "center" },
  monthYearWrap: { gap: mobileSpacing.md },
  monthYearLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  pillOn: {
    backgroundColor: mobileColors.accent
  },
  pillTx: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary
  },
  pillTxOn: {
    color: mobileColors.onAccent,
    fontWeight: "700"
  }
});
