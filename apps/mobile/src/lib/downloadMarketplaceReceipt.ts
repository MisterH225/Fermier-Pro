import { cacheDirectory, downloadAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { apiAuthHeaders, marketplaceReceiptPdfAbsoluteUrl } from "./api";

/** Télécharge un PDF reçu via l'API (stream) et ouvre la feuille de partage native. */
export async function downloadAndShareReceiptPdf(
  transactionId: string,
  accessToken: string,
  activeProfileId: string | null | undefined,
  receiptNumber?: string | null
): Promise<void> {
  const url = marketplaceReceiptPdfAbsoluteUrl(transactionId);
  const safeName = (receiptNumber ?? transactionId).replace(/[^a-zA-Z0-9-]/g, "");
  const base = cacheDirectory ?? "";
  const localPath = `${base}${safeName}.pdf`;
  const result = await downloadAsync(url, localPath, {
    headers: apiAuthHeaders(accessToken, activeProfileId)
  });
  if (result.status !== 200) {
    throw new Error("Téléchargement du reçu impossible");
  }
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Partage non disponible sur cet appareil");
  }
  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: receiptNumber ?? "Reçu"
  });
}
