import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { fromIsoDateString } from "../../lib/appDate";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { AppDatePicker } from "./AppDatePicker";

type Props = {
  startIso: string;
  endIso: string;
  onChange: (start: string, end: string) => void;
  farmId?: string;
  startLabel?: string;
  endLabel?: string;
  minDate?: Date | null;
  maxDate?: Date | null;
};

export function AppDateRangePicker({
  startIso,
  endIso,
  onChange,
  farmId,
  startLabel,
  endLabel,
  minDate,
  maxDate
}: Props) {
  const { t } = useTranslation();
  const [rangeError, setRangeError] = useState<string | null>(null);
  const rangeErrorMessage = t("datePicker.rangeError");

  useEffect(() => {
    if (!startIso || !endIso) {
      setRangeError(null);
      return;
    }
    const s = fromIsoDateString(startIso);
    const e = fromIsoDateString(endIso);
    if (s && e && e.getTime() < s.getTime()) {
      setRangeError(rangeErrorMessage);
    } else {
      setRangeError(null);
    }
  }, [startIso, endIso, rangeErrorMessage]);

  return (
    <View style={styles.wrap}>
      <AppDatePicker
        label={startLabel ?? t("datePicker.rangeStart")}
        isoValue={startIso}
        onIsoChange={(iso) => onChange(iso, endIso)}
        farmId={farmId}
        minDate={minDate}
        maxDate={endIso ? (fromIsoDateString(endIso) ?? maxDate) : maxDate}
      />
      <AppDatePicker
        label={endLabel ?? t("datePicker.rangeEnd")}
        isoValue={endIso}
        onIsoChange={(iso) => onChange(startIso, iso)}
        farmId={farmId}
        minDate={
          startIso ? fromIsoDateString(startIso) ?? minDate : minDate
        }
        maxDate={maxDate}
        error={rangeError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
