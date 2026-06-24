import * as WebBrowser from "expo-web-browser";

/**
 * Ouvre la page de checkout GeniusPay si une URL est fournie.
 * Retourne true si l'utilisateur peut tenter la confirmation côté API.
 */
export async function openPaymentCheckout(
  paymentUrl: string | null | undefined
): Promise<void> {
  const url = paymentUrl?.trim();
  if (!url) return;
  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC
  });
}
