import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { FarmDto } from "../../lib/api";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography,
  mobileFontSize
} from "../../theme/mobileTheme";
import { ProjectSwitcher } from "./ProjectSwitcher";

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Modal dédiée au bascule de projet (Dashboard / profil).
 * Évite d’ouvrir le profil pour changer de ferme.
 */
export function ProjectSwitcherModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const go = (fn: () => void) => {
    onClose();
    // Laisser la modal se fermer avant la navigation stack.
    requestAnimationFrame(fn);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            testID="project-switcher-modal-close"
          >
            <Ionicons
              name="close"
              size={26}
              color={mobileColors.textPrimary}
            />
          </Pressable>
          <Text style={styles.title}>{t("producer.projects.title")}</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <ProjectSwitcher
          onCreateProject={() =>
            go(() => navigation.navigate("CreateFarm"))
          }
          onUpgradeToPremium={() =>
            go(() => navigation.navigate("ProducerSubscription"))
          }
          onEditProject={(farm: FarmDto) =>
            go(() =>
              navigation.navigate("FarmDetail", {
                farmId: farm.id,
                farmName: farm.name
              })
            )
          }
          onClose={onClose}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: mobileColors.background
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  title: {
    ...mobileTypography.title,
    fontSize: mobileFontSize.lg,
    color: mobileColors.textPrimary
  },
  topBarSpacer: {
    width: 26
  }
});
