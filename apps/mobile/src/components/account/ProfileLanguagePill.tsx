import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View
} from "react-native";
import i18n from "../../i18n/i18n";
import { type AppLocaleCode, setStoredAppLocale } from "../../lib/appLocale";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing } from "../../theme/mobileTheme";

/** Largeur du menu déroulant (compact). */
const MENU_WIDTH = 128;
const PILL_H = 36;

const OPTIONS: Array<{ code: AppLocaleCode; label: string; flag: string }> = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" }
];

type ProfileLanguagePillProps = {
  /**
   * Si vrai, le menu s’ouvre sous le bord droit de l’écran (même marge que « Fermer »).
   */
  alignMenuWithCloseRow?: boolean;
  /** Marge horizontale pour aligner le menu sur le bouton fermer (ex. `mobileSpacing.lg`). */
  edgePadding?: number;
};

/**
 * Pastille drapeau + chevron ; menu compact ancré à droite ou sous la pastille.
 */
export function ProfileLanguagePill({
  alignMenuWithCloseRow = false,
  edgePadding = mobileSpacing.lg
}: ProfileLanguagePillProps) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const pillRef = useRef<View>(null);

  const currentCode = useMemo(() => {
    const raw = (i18n.resolvedLanguage ?? i18n.language).split("-")[0];
    return raw === "en" ? "en" : "fr";
  }, [i18n.language, i18n.resolvedLanguage]);

  const currentFlag =
    OPTIONS.find((o) => o.code === currentCode)?.flag ?? OPTIONS[0].flag;

  const openMenu = useCallback(() => {
    pillRef.current?.measureInWindow((x, y, w, h) => {
      const top = y + h + 6;
      let left: number;
      if (alignMenuWithCloseRow) {
        left = Math.max(
          edgePadding,
          windowWidth - edgePadding - MENU_WIDTH
        );
      } else {
        left = Math.max(edgePadding, x + w - MENU_WIDTH);
      }
      setMenuLayout({
        top,
        left,
        width: MENU_WIDTH
      });
      setOpen(true);
    });
  }, [alignMenuWithCloseRow, edgePadding, windowWidth]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setMenuLayout(null);
  }, []);

  const onPick = async (code: AppLocaleCode) => {
    await setStoredAppLocale(code);
    await i18n.changeLanguage(code);
    closeMenu();
  };

  return (
    <>
      <View ref={pillRef} collapsable={false} style={styles.anchor}>
        <Pressable
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
          onPress={() => (open ? closeMenu() : openMenu())}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={t("account.languageSelectA11y")}
        >
          <Text style={styles.pillFlag}>{currentFlag}</Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={14}
            color="#fff"
          />
        </Pressable>
      </View>

      <Modal
        visible={open && menuLayout != null}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.modalFill}>
            {menuLayout ? (
              <View
                style={[
                  styles.menu,
                  {
                    top: menuLayout.top,
                    left: menuLayout.left,
                    width: menuLayout.width
                  }
                ]}
                pointerEvents="box-none"
              >
                {OPTIONS.map((opt, index) => {
                  const selected = opt.code === currentCode;
                  return (
                    <Pressable
                      key={opt.code}
                      style={({ pressed }) => [
                        styles.menuRow,
                        index < OPTIONS.length - 1 && styles.menuRowDivider,
                        selected && styles.menuRowSelected,
                        pressed && !selected && styles.menuRowPressed
                      ]}
                      onPress={() => void onPick(opt.code)}
                    >
                      <Text
                        style={[
                          styles.menuLabel,
                          selected && styles.menuLabelSelected
                        ]}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.menuFlag}>{opt.flag}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    zIndex: 40
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: PILL_H,
    paddingHorizontal: 10,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.accent,
    ...mobileShadows.card
  },
  pillPressed: {
    opacity: 0.92
  },
  pillFlag: {
    fontSize: 20,
    lineHeight: PILL_H - 4
  },
  modalFill: {
    flex: 1,
    backgroundColor: "rgba(47, 158, 68, 0.14)"
  },
  menu: {
    position: "absolute",
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    overflow: "hidden",
    ...mobileShadows.card,
    elevation: 12
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: mobileColors.accentSoft
  },
  menuRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(47, 158, 68, 0.22)"
  },
  menuRowSelected: {
    backgroundColor: mobileColors.accent
  },
  menuRowPressed: {
    opacity: 0.88
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: mobileColors.textPrimary,
    flex: 1,
    marginRight: 6
  },
  menuLabelSelected: {
    color: "#fff"
  },
  menuFlag: {
    fontSize: 17
  }
});
