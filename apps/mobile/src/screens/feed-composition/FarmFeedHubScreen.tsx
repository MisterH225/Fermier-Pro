import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../context/SessionContext";
import { isFeedCompositionModuleActive } from "../../lib/feedComposition";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FarmFeedHub">;

export function FarmFeedHubScreen({ navigation, route }: Props) {
  const { farmId, farmName } = route.params;
  const { platformModules, clientFeatures } = useSession();
  const compositionOn = isFeedCompositionModuleActive(platformModules);
  const stockOn = clientFeatures.feedStock;

  return (
    <View style={styles.root} testID="farm-feed-hub">
      <Text style={styles.intro}>
        Choisissez ce que vous voulez faire pour {farmName}.
      </Text>

      {stockOn ? (
        <Pressable
          style={styles.card}
          testID="hub-stock"
          onPress={() =>
            navigation.navigate("FarmFeedStock", { farmId, farmName })
          }
        >
          <View style={styles.iconWrap}>
            <Ionicons name="leaf-outline" size={26} color={mobileColors.accent} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Stock</Text>
            <Text style={styles.cardSub}>Achats et stock restant</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={mobileColors.textSecondary} />
        </Pressable>
      ) : null}

      {compositionOn ? (
        <>
          <Pressable
            style={styles.card}
            testID="hub-composition"
            onPress={() =>
              navigation.navigate("FeedComposition", { farmId, farmName })
            }
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name="flask-outline"
                size={26}
                color={mobileColors.accent}
              />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Composition</Text>
              <Text style={styles.cardSub}>
                Formuler une ration (assistée ou formulaire)
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={mobileColors.textSecondary}
            />
          </Pressable>

          <Pressable
            style={styles.card}
            testID="hub-saved"
            onPress={() =>
              navigation.navigate("FeedCompositionsList", { farmId, farmName })
            }
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name="bookmark-outline"
                size={26}
                color={mobileColors.accent}
              />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Mes compositions</Text>
              <Text style={styles.cardSub}>
                Enregistrées, en revue véto ou validées
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={mobileColors.textSecondary}
            />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileColors.canvas,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  intro: {
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.border,
    padding: mobileSpacing.lg
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  cardSub: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary
  }
});
