import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sentry } from "../lib/sentry";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";

type Props = {
  children: ReactNode;
  onReset?: () => void;
};

type State = {
  error: Error | null;
};

/**
 * Empêche une erreur de rendu isolée de fermer toute l'application.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.error("[AppErrorBoundary]", error, info.componentStack);
    }
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: info.componentStack ?? undefined
        }
      }
    });
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Un problème est survenu</Text>
          <Text style={styles.body}>
            L&apos;application a rencontré une erreur inattendue. Réessayez ou
            redémarrez l&apos;application.
          </Text>
          <Pressable style={styles.btn} onPress={this.handleRetry}>
            <Text style={styles.btnTx}>Réessayer</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: mobileColors.canvas,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing.xl,
    gap: mobileSpacing.md
  },
  title: {
    ...mobileTypography.title,
    fontSize: 22,
    textAlign: "center"
  },
  body: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  btn: {
    marginTop: mobileSpacing.md,
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.xl,
    paddingVertical: 14,
    borderRadius: 12
  },
  btnTx: { color: mobileColors.onAccent, fontWeight: "700" }
});
