import { createHmac, timingSafeEqual } from "crypto";
import {
  BadRequestException,
  UnauthorizedException
} from "@nestjs/common";

const REPLAY_TOLERANCE_SEC = 300;

export function verifyGeniusPayWebhookSignature(params: {
  signature: string | undefined;
  timestamp: string | undefined;
  payload: unknown;
  secret: string | undefined;
}): void {
  const secret = params.secret?.trim();
  if (!secret) {
    throw new UnauthorizedException("GENIUSPAY_WEBHOOK_SECRET non configuré");
  }
  const signature = params.signature?.trim();
  const timestamp = params.timestamp?.trim();
  if (!signature) {
    throw new UnauthorizedException("Signature webhook GeniusPay manquante");
  }
  if (!timestamp) {
    throw new UnauthorizedException("Timestamp webhook GeniusPay manquant");
  }

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) {
    throw new BadRequestException("Timestamp webhook GeniusPay invalide");
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > REPLAY_TOLERANCE_SEC) {
    throw new BadRequestException("Timestamp webhook GeniusPay expiré");
  }

  const payloadJson = JSON.stringify(params.payload);
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payloadJson}`)
    .digest("hex");

  try {
    const ok = timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8")
    );
    if (!ok) {
      throw new UnauthorizedException("Signature webhook GeniusPay invalide");
    }
  } catch {
    throw new UnauthorizedException("Signature webhook GeniusPay invalide");
  }
}
