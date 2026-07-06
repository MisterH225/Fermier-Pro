import { createHmac, timingSafeEqual } from "crypto";
import {
  BadRequestException,
  UnauthorizedException
} from "@nestjs/common";

const REPLAY_TOLERANCE_SEC = 300;

const WEBHOOK_SECRET_HINT =
  "Vérifiez GENIUSPAY_WEBHOOK_SECRET sur Railway : secret whsec_sandbox_… " +
  "(affiché une seule fois à la création du webhook GeniusPay), pas sk_ ni pk_.";

export function normalizeGeniusPayWebhookSecret(
  secret: string | undefined
): string {
  return secret?.trim() ?? "";
}

/** Valide le format attendu du secret webhook GeniusPay. */
export function isLikelyGeniusPayWebhookSecret(secret: string): boolean {
  return /^whsec_(sandbox|live)_/i.test(secret.trim());
}

function normalizeSignature(signature: string): string {
  return signature.trim().replace(/^sha256=/i, "").toLowerCase();
}

function computeExpectedSignature(
  timestamp: string,
  payload: string,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
}

function safeCompareHex(expected: string, provided: string): boolean {
  const a = normalizeSignature(expected);
  const b = normalizeSignature(provided);
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

function candidatePayloads(rawPayload: string, parsedPayload?: unknown): string[] {
  const raw = rawPayload;
  const candidates = [raw];
  if (parsedPayload !== undefined) {
    const serialized = JSON.stringify(parsedPayload);
    if (serialized !== raw) {
      candidates.push(serialized);
    }
  }
  return candidates;
}

export function verifyGeniusPayWebhookSignature(params: {
  signature: string | undefined;
  timestamp: string | undefined;
  /** Corps JSON brut tel qu'envoyé par GeniusPay (obligatoire pour HMAC). */
  rawPayload: string | Buffer;
  secret: string | undefined;
  /** Fallback si GeniusPay signe json_encode(PHP) plutôt que le corps brut. */
  parsedPayload?: unknown;
}): void {
  const secret = normalizeGeniusPayWebhookSecret(params.secret);
  if (!secret) {
    throw new UnauthorizedException(
      `GENIUSPAY_WEBHOOK_SECRET non configuré. ${WEBHOOK_SECRET_HINT}`
    );
  }
  if (!isLikelyGeniusPayWebhookSecret(secret)) {
    throw new UnauthorizedException(
      `GENIUSPAY_WEBHOOK_SECRET invalide (attendu whsec_sandbox_… ou whsec_live_…). ${WEBHOOK_SECRET_HINT}`
    );
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

  const raw =
    typeof params.rawPayload === "string"
      ? params.rawPayload
      : params.rawPayload.toString("utf8");
  if (!raw.trim()) {
    throw new BadRequestException("Corps webhook GeniusPay manquant");
  }

  let parsed = params.parsedPayload;
  if (parsed === undefined) {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = undefined;
    }
  }

  for (const payload of candidatePayloads(raw, parsed)) {
    const expected = computeExpectedSignature(timestamp, payload, secret);
    if (safeCompareHex(expected, signature)) {
      return;
    }
  }

  throw new UnauthorizedException(
    `Signature webhook GeniusPay invalide. ${WEBHOOK_SECRET_HINT}`
  );
}
