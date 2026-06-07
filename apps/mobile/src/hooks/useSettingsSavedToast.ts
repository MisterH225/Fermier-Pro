import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** Retourne un indicateur bref « Paramètres sauvegardés » (2 s). */
export function useSettingsSavedToast() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSaved = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), 2000);
  }, []);

  return {
    savedToastVisible: visible,
    savedToastMessage: t("settings.savedToast"),
    showSaved
  };
}
