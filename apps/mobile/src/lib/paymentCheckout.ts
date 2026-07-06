import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

/**
 * Ouvre la page de checkout GeniusPay (navigateur in-app ou navigateur système).
 */
export async function openPaymentCheckout(
  paymentUrl: string | null | undefined
): Promise<void> {
  const url = paymentUrl?.trim();
  if (!url) {
    throw new Error("MARKETPLACE_CHECKOUT_URL_MISSING");
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error("MARKETPLACE_CHECKOUT_URL_INVALID");
  }

  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      enableBarCollapsing: false,
      showInRecents: true
    });
  } catch {
    await Linking.openURL(url);
  }
}
