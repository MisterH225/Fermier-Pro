import { cacheDirectory, downloadAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

/** Télécharge un PDF reçu et ouvre la feuille de partage native. */
export async function downloadAndShareReceiptPdf(
  downloadUrl: string,
  receiptNumber: string
): Promise<void> {
  const safeName = receiptNumber.replace(/[^a-zA-Z0-9-]/g, "");
  const base = cacheDirectory ?? "";
  const localPath = `${base}${safeName}.pdf`;
  const result = await downloadAsync(downloadUrl, localPath);
  if (result.status !== 200) {
    throw new Error("Téléchargement du reçu impossible");
  }
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Partage non disponible sur cet appareil");
  }
  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: receiptNumber
  });
}
