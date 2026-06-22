import { Logger } from "@nestjs/common";

const log = new Logger("ReportImageUtil");

/** Télécharge une image distante et la convertit en data URL pour pdfmake. */
export async function fetchUrlAsDataUrl(url: string | null | undefined): Promise<string | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(trimmed, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      log.warn(`Avatar fetch HTTP ${res.status} for ${trimmed.slice(0, 80)}`);
      return null;
    }
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      log.warn(`Avatar fetch: unexpected content-type ${contentType}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32 || buf.length > 2_000_000) {
      log.warn(`Avatar fetch: size out of range (${buf.length} bytes)`);
      return null;
    }
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch (e) {
    log.warn(`Avatar fetch failed: ${String(e)}`);
    return null;
  }
}
