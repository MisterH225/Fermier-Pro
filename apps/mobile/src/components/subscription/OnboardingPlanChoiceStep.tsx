import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScrollBottomPad } from "../../hooks/useScrollBottomPad";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";
import {
  PlanChoiceCards,
  type PlanChoiceLimits,
  type PlanChoiceRole
} from "./PlanChoiceCards";

type Props = {
  role: PlanChoiceRole;
  loadLimits: () => Promise<PlanChoiceLimits>;
  busy?: boolean;
  onChooseStandard: () => void | Promise<void>;
  onChoosePremium: () => void | Promise<void>;
  onChooseLater: () => void | Promise<void>;
};

export function OnboardingPlanChoiceStep({
  role,
  loadLimits,
  busy = false,
  onChooseStandard,
  onChoosePremium,
  onChooseLater
}: Props) {
  const scrollPad = useScrollBottomPad({ includeChrome: false });
  const [limits, setLimits] = useState<PlanChoiceLimits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await loadLimits();
        if (!cancelled) {
          setLimits(data);
        }
      } catch {
        if (!cancelled) {
          setLimits({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLimits]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]}
        keyboardShouldPersistTaps="handled"
      >
        <PlanChoiceCards
          role={role}
          limits={limits}
          loading={loading}
          busy={busy}
          onChooseStandard={() => void onChooseStandard()}
          onChoosePremium={() => void onChoosePremium()}
          onChooseLater={() => void onChooseLater()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.canvas },
  scroll: {
    padding: mobileSpacing.lg,
    flexGrow: 1
  }
});
