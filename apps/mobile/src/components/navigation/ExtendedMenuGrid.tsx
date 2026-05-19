import { Ionicons } from "@expo/vector-icons";

import { useEffect, useMemo, useRef } from "react";

import {

  Animated,

  Modal,

  Pressable,

  ScrollView,

  StyleSheet,

  View

} from "react-native";

import { useTranslation } from "react-i18next";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

import { EXTENDED_MENU_ICONS } from "./extendedMenuIcons";

import { EXTENDED_MENU_TILE_HEIGHT, ExtendedMenuItem } from "./ExtendedMenuItem";

import {

  PRODUCER_NAV_BAR_HEIGHT,

  PRODUCER_NAV_FLOAT_BOTTOM

} from "./producerNavMetrics";

import type { ExtendedNavMenuId } from "./types";



const H_PAD = mobileSpacing.lg;

const TILE_GAP = mobileSpacing.sm;

const PANEL_V_PAD = mobileSpacing.sm;

/** Max 4 tuiles par ligne (colonne visuelle). */

const MAX_ITEMS_PER_ROW = 4;

/** 2 à 3 lignes selon le nombre d’entrées. */

const MAX_ROWS = 3;

const CLOSE_SIZE = 56;

const PANEL_BG = "rgba(58,58,60,0.94)";



type MenuEntry = {

  id: ExtendedNavMenuId;

  label: string;

  a11y: string;

  badgeCount?: number;

};



/** Découpe en lignes de 4 max, jusqu’à 3 lignes (12 entrées visibles). */

export function layoutExtendedMenuRows<T>(entries: T[]): T[][] {

  const rows: T[][] = [];

  let index = 0;

  while (index < entries.length && rows.length < MAX_ROWS) {

    rows.push(entries.slice(index, index + MAX_ITEMS_PER_ROW));

    index += MAX_ITEMS_PER_ROW;

  }

  return rows;

}



/** Colonnes de 4 max pour le défilement horizontal au-delà de 12 entrées. */

export function layoutExtendedMenuColumns<T>(entries: T[]): T[][] {

  const columns: T[][] = [];

  for (let index = 0; index < entries.length; index += MAX_ITEMS_PER_ROW) {

    columns.push(entries.slice(index, index + MAX_ITEMS_PER_ROW));

  }

  return columns;

}



type ExtendedMenuGridProps = {

  visible: boolean;

  onClose: () => void;

  items: MenuEntry[];

  onSelect: (id: ExtendedNavMenuId) => void;

};



function MenuTile({

  item,

  onPress

}: {

  item: MenuEntry;

  onPress: (id: ExtendedNavMenuId) => void;

}) {

  return (

    <ExtendedMenuItem

      icon={EXTENDED_MENU_ICONS[item.id]}

      label={item.label}

      accessibilityLabel={item.a11y}

      badgeCount={item.badgeCount}

      onPress={() => onPress(item.id)}

    />

  );

}



export function ExtendedMenuGrid({

  visible,

  onClose,

  items,

  onSelect

}: ExtendedMenuGridProps) {

  const { t } = useTranslation();

  const insets = useSafeAreaInsets();

  const opacity = useRef(new Animated.Value(0)).current;

  const translateY = useRef(new Animated.Value(16)).current;



  useEffect(() => {

    if (!visible) {

      return;

    }

    opacity.setValue(0);

    translateY.setValue(16);

    Animated.parallel([

      Animated.timing(opacity, {

        toValue: 1,

        duration: 200,

        useNativeDriver: true

      }),

      Animated.spring(translateY, {

        toValue: 0,

        friction: 9,

        tension: 80,

        useNativeDriver: true

      })

    ]).start();

  }, [visible, opacity, translateY]);



  const runClose = () => {

    Animated.parallel([

      Animated.timing(opacity, {

        toValue: 0,

        duration: 150,

        useNativeDriver: true

      }),

      Animated.timing(translateY, {

        toValue: 12,

        duration: 150,

        useNativeDriver: true

      })

    ]).start(({ finished }) => {

      if (finished) {

        onClose();

      }

    });

  };



  const onItemPress = (id: ExtendedNavMenuId) => {

    onClose();

    onSelect(id);

  };



  const bottomOffset =

    insets.bottom +

    PRODUCER_NAV_FLOAT_BOTTOM +

    PRODUCER_NAV_BAR_HEIGHT +

    mobileSpacing.sm;



  const maxVisible = MAX_ITEMS_PER_ROW * MAX_ROWS;

  const primaryItems = useMemo(

    () => items.slice(0, maxVisible),

    [items, maxVisible]

  );

  const overflowItems = useMemo(

    () => items.slice(maxVisible),

    [items, maxVisible]

  );



  const rows = useMemo(() => layoutExtendedMenuRows(primaryItems), [primaryItems]);

  const overflowColumns = useMemo(

    () => layoutExtendedMenuColumns(overflowItems),

    [overflowItems]

  );



  const rowCount = Math.max(

    rows.length,

    overflowColumns.reduce((max, col) => Math.max(max, col.length), 0)

  );

  const panelHeight =

    rowCount * EXTENDED_MENU_TILE_HEIGHT +

    Math.max(0, rowCount - 1) * TILE_GAP +

    PANEL_V_PAD * 2 +

    (overflowItems.length > 0 ? TILE_GAP : 0);



  return (

    <Modal

      visible={visible}

      transparent

      animationType="none"

      statusBarTranslucent

      onRequestClose={runClose}

    >

      <View style={styles.modalRoot}>

        <Pressable

          style={[StyleSheet.absoluteFill, styles.backdrop]}

          onPress={runClose}

          accessibilityLabel={t("navigation.extended.closeBackdropA11y")}

        />

        <Animated.View

          style={[

            styles.sheetAnchor,

            {

              paddingHorizontal: H_PAD,

              paddingBottom: bottomOffset,

              opacity,

              transform: [{ translateY }]

            }

          ]}

          pointerEvents="box-none"

        >

          <View style={styles.sheetRow}>

            <View style={[styles.panel, { minHeight: panelHeight }]}>

              <View style={styles.panelInner}>

                {rows.map((row, rowIndex) => (

                  <View key={`row-${rowIndex}`} style={styles.menuRow}>

                    {row.map((item) => (

                      <MenuTile key={item.id} item={item} onPress={onItemPress} />

                    ))}

                  </View>

                ))}

                {overflowColumns.length > 0 ? (

                  <ScrollView

                    horizontal

                    showsHorizontalScrollIndicator={false}

                    contentContainerStyle={styles.overflowColumns}

                  >

                    {overflowColumns.map((column, colIndex) => (

                      <View key={`col-${colIndex}`} style={styles.menuColumn}>

                        {column.map((item) => (

                          <MenuTile key={item.id} item={item} onPress={onItemPress} />

                        ))}

                      </View>

                    ))}

                  </ScrollView>

                ) : null}

              </View>

            </View>

            <Pressable

              accessibilityRole="button"

              accessibilityLabel={t("navigation.extended.closeA11y")}

              onPress={runClose}

              style={({ pressed }) => [

                styles.closeFab,

                pressed && styles.closeFabPressed

              ]}

            >

              <Ionicons name="close" size={26} color="#FFFFFF" />

            </Pressable>

          </View>

        </Animated.View>

      </View>

    </Modal>

  );

}



const styles = StyleSheet.create({

  modalRoot: {

    flex: 1,

    justifyContent: "flex-end"

  },

  backdrop: {

    backgroundColor: "rgba(0,0,0,0.72)"

  },

  sheetAnchor: {

    width: "100%"

  },

  sheetRow: {

    flexDirection: "row",

    alignItems: "flex-end",

    gap: mobileSpacing.sm

  },

  panel: {

    flex: 1,

    borderRadius: mobileRadius.lg,

    backgroundColor: PANEL_BG,

    borderWidth: StyleSheet.hairlineWidth,

    borderColor: "rgba(255,255,255,0.14)",

    overflow: "hidden",

    shadowColor: "#000",

    shadowOffset: { width: 0, height: 4 },

    shadowOpacity: 0.28,

    shadowRadius: 12,

    elevation: 8

  },

  panelInner: {

    paddingVertical: PANEL_V_PAD,

    paddingHorizontal: mobileSpacing.sm,

    gap: TILE_GAP

  },

  menuRow: {

    flexDirection: "row",

    alignItems: "flex-start",

    justifyContent: "flex-start",

    gap: TILE_GAP

  },

  menuColumn: {

    gap: TILE_GAP

  },

  overflowColumns: {

    flexDirection: "row",

    gap: TILE_GAP,

    paddingTop: TILE_GAP,

    borderTopWidth: StyleSheet.hairlineWidth,

    borderTopColor: "rgba(255,255,255,0.12)"

  },

  closeFab: {

    width: CLOSE_SIZE,

    height: CLOSE_SIZE,

    borderRadius: CLOSE_SIZE / 2,

    backgroundColor: PANEL_BG,

    borderWidth: StyleSheet.hairlineWidth,

    borderColor: "rgba(255,255,255,0.14)",

    alignItems: "center",

    justifyContent: "center",

    shadowColor: "#000",

    shadowOffset: { width: 0, height: 4 },

    shadowOpacity: 0.28,

    shadowRadius: 12,

    elevation: 8

  },

  closeFabPressed: {

    opacity: 0.88

  }

});


