import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import {
  FarmGestationPanel,
  type FarmGestationPanelTabId
} from "../components/gestation/FarmGestationPanel";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { mobileColors } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmGestation">;

/**
 * Route standalone conservée (deep links, checklist, rappels de mise bas).
 * Le contenu UI vit dans `FarmGestationPanel` (aussi embarqué dans Cheptel).
 */
export function FarmGestationScreen({ route, navigation }: Props) {
  const {
    farmId,
    farmName,
    initialTab,
    openGestationId,
    autoOpenDetail,
    autoOpenLitter,
    tab,
    highlightSowId
  } = route.params;
  const { t } = useTranslation();
  const [openCreate, setOpenCreate] = useState<(() => void) | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  const onCreateRequestChange = useCallback(
    (fn: (() => void) | null, isReadOnly: boolean) => {
      setOpenCreate(() => fn);
      setReadOnly(isReadOnly);
    },
    []
  );

  useScreenTitle(navigation, t("navigation.extended.gestation"), {
    headerRight:
      readOnly || !openCreate
        ? undefined
        : () => (
            <Pressable
              onPress={openCreate}
              accessibilityLabel={t("gestationScreen.createTitle")}
              style={{ padding: 8 }}
            >
              <Ionicons
                name="add-circle-outline"
                size={26}
                color={mobileColors.accent}
              />
            </Pressable>
          )
  });

  return (
    <FarmGestationPanel
      farmId={farmId}
      farmName={farmName}
      navigation={navigation}
      initialTab={initialTab as FarmGestationPanelTabId | undefined}
      openGestationId={openGestationId}
      autoOpenDetail={autoOpenDetail}
      autoOpenLitter={autoOpenLitter}
      tab={tab === "planning" ? "planning" : undefined}
      highlightSowId={highlightSowId}
      embedded={false}
      onCreateRequestChange={onCreateRequestChange}
    />
  );
}
