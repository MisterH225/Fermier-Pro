import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import {
  createCompositionOrder,
  fetchCompositionMillPrices,
  type MillCompositionPriceDto
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { formatXof } from "../../lib/feedCompositionFormat";
import type { RootStackParamList } from "../../types/navigation";
import {
  compositionUiColors,
  type CompositionUiTone
} from "../../theme/compositionUiTone";
import {
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "MillPricesCompare">;

const DEFAULT_RADIUS_KM = 50;

function formatDistance(km: number | null): string {
  if (km == null || !Number.isFinite(km)) {
    return "Distance inconnue";
  }
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

function MillRow({
  mill,
  selected,
  onSelect,
  tone
}: {
  mill: MillCompositionPriceDto;
  selected: boolean;
  onSelect: () => void;
  tone: CompositionUiTone;
}) {
  const ui = compositionUiColors(tone);
  const complete = mill.availabilityComplete;

  return (
    <Pressable
      onPress={complete ? onSelect : undefined}
      disabled={!complete}
      style={[
        styles.millCard,
        {
          borderColor: selected ? ui.accent : ui.border,
          backgroundColor: ui.background,
          opacity: complete ? 1 : 0.55
        }
      ]}
      testID={`mill-row-${mill.millId}`}
    >
      <View style={styles.millHeader}>
        <Text style={[styles.millName, { color: ui.textPrimary }]}>
          {mill.millName}
        </Text>
        <Text style={[styles.millPrice, { color: ui.accent }]}>
          {formatXof(mill.totalPriceXof)}
        </Text>
      </View>
      <Text style={[styles.millMeta, { color: ui.textSecondary }]}>
        {formatDistance(mill.distanceKm)}
        {mill.mixingCost > 0
          ? ` · mélange ${formatXof(mill.mixingCost)}`
          : ""}
      </Text>
      {!complete ? (
        <Text style={[styles.missing, { color: ui.textSecondary }]}>
          Intrants manquants :{" "}
          {mill.missingIngredients
            .map((m) => m.canonicalName ?? m.feedIngredientId)
            .join(", ")}
        </Text>
      ) : (
        <Text style={[styles.complete, { color: ui.accent }]}>
          Tous les intrants disponibles
        </Text>
      )}
    </Pressable>
  );
}

export function MillPricesCompareScreen({ navigation, route }: Props) {
  const { compositionId, farmId, farmName } = route.params;
  const { accessToken, activeProfileId } = useSession();
  const bottomPad = useBottomInset();
  const tone: CompositionUiTone = "producer";
  const ui = compositionUiColors(tone);
  const [radiusKm, setRadiusKm] = useState(String(DEFAULT_RADIUS_KM));
  const [selectedMillId, setSelectedMillId] = useState<string | null>(null);

  const parsedRadius = Number(radiusKm);
  const effectiveRadius =
    Number.isFinite(parsedRadius) && parsedRadius > 0
      ? parsedRadius
      : DEFAULT_RADIUS_KM;

  const pricesQ = useQuery({
    queryKey: ["composition-mill-prices", compositionId, effectiveRadius],
    queryFn: () =>
      fetchCompositionMillPrices(
        accessToken!,
        compositionId,
        effectiveRadius,
        activeProfileId
      ),
    enabled: Boolean(accessToken)
  });

  const orderMut = useMutation({
    mutationFn: (millProfileId: string) =>
      createCompositionOrder(
        accessToken!,
        compositionId,
        { millProfileId, radiusKm: effectiveRadius },
        activeProfileId
      ),
    onSuccess: (order) => {
      navigation.replace("CompositionOrderDetail", {
        orderId: order.id,
        farmId,
        farmName
      });
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const mills = pricesQ.data?.mills ?? [];
  const completeMills = mills.filter((m) => m.availabilityComplete);

  const onSendOrder = () => {
    if (!selectedMillId) {
      Alert.alert(
        "Choisir un moulin",
        "Sélectionnez un moulin avec tous les intrants disponibles."
      );
      return;
    }
    const mill = mills.find((m) => m.millId === selectedMillId);
    Alert.alert(
      "Confirmer la commande",
      `Envoyer cette composition à ${mill?.millName ?? "ce moulin"} pour ${formatXof(mill?.totalPriceXof ?? 0)} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Commander",
          onPress: () => orderMut.mutate(selectedMillId)
        }
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: ui.canvas }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: ui.textPrimary }]}>
          Comparer les moulins
        </Text>
        <Text style={[styles.subtitle, { color: ui.textSecondary }]}>
          {farmName} — rayon de recherche
        </Text>
        <TextInput
          style={[
            styles.radiusInput,
            {
              color: ui.textPrimary,
              borderColor: ui.border,
              backgroundColor: ui.surfaceMuted
            }
          ]}
          value={radiusKm}
          onChangeText={setRadiusKm}
          keyboardType="numeric"
          placeholder="Rayon (km)"
          placeholderTextColor={ui.textSecondary}
          testID="radius-input"
        />
      </View>

      {pricesQ.isPending ? (
        <ActivityIndicator color={ui.accent} style={{ marginTop: 40 }} />
      ) : pricesQ.isError ? (
        <Text style={[styles.error, { color: ui.textPrimary }]}>
          {formatApiError(pricesQ.error)}
        </Text>
      ) : (
        <FlatList
          data={mills}
          keyExtractor={(item) => item.millId}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad + 88 }
          ]}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: ui.textSecondary }]}>
              Aucun moulin trouvé dans ce rayon.
            </Text>
          }
          renderItem={({ item }) => (
            <MillRow
              mill={item}
              selected={selectedMillId === item.millId}
              onSelect={() => setSelectedMillId(item.millId)}
              tone={tone}
            />
          )}
        />
      )}

      <View
        style={[
          styles.footer,
          { paddingBottom: bottomPad + mobileSpacing.md, backgroundColor: ui.canvas }
        ]}
      >
        <Pressable
          style={[
            styles.primaryBtn,
            {
              backgroundColor: ui.accent,
              opacity:
                !selectedMillId || orderMut.isPending || completeMills.length === 0
                  ? 0.45
                  : 1
            }
          ]}
          onPress={onSendOrder}
          disabled={!selectedMillId || orderMut.isPending}
          testID="send-composition-order"
        >
          {orderMut.isPending ? (
            <ActivityIndicator color={ui.onAccent} />
          ) : (
            <Text style={[styles.primaryBtnLabel, { color: ui.onAccent }]}>
              Commander chez ce moulin
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  title: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800"
  },
  subtitle: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600"
  },
  radiusInput: {
    borderWidth: 1,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    fontSize: mobileFontSize.md
  },
  list: {
    paddingHorizontal: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  millCard: {
    borderWidth: 2,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: mobileSpacing.xs,
    marginBottom: mobileSpacing.sm
  },
  millHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: mobileSpacing.sm
  },
  millName: {
    flex: 1,
    fontSize: mobileFontSize.md,
    fontWeight: "800"
  },
  millPrice: {
    fontSize: mobileFontSize.md,
    fontWeight: "800"
  },
  millMeta: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600"
  },
  missing: {
    fontSize: mobileFontSize.xs,
    lineHeight: 17
  },
  complete: {
    fontSize: mobileFontSize.xs,
    fontWeight: "700"
  },
  empty: {
    textAlign: "center",
    marginTop: mobileSpacing.xl,
    fontSize: mobileFontSize.sm
  },
  error: {
    textAlign: "center",
    marginTop: mobileSpacing.xl,
    paddingHorizontal: mobileSpacing.lg
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm
  },
  primaryBtn: {
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  primaryBtnLabel: {
    fontWeight: "800",
    textAlign: "center"
  }
});
