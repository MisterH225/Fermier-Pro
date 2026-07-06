import { createHmac, timingSafeEqual } from "crypto";
import {
  BadRequestException,
  UnauthorizedException
} from "@nestjs/common";

const REPLAY_TOLERANCE_SEC = 300;

const WEBHOOK_SECRET_HINT =
  "Le secret doit être celui affiché à la création du webhook GeniusPay (whsec_…), " +
  "recopié dans GENIUSPAY_WEBHOOK_SECRET sur Railway — pas GENIUSPAY_API_SECRET (sk_). " +
  "Si le webhook a été recréé, regénérez le secret.";

export function normalizeGeniusPayWebhookSecret(
  secret: string | undefined
): string {
  let s = secret?.trim() ?? "";
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Valide le format attendu du secret webhook GeniusPay. */
export function isLikelyGeniusPayWebhookSecret(secret: string): boolean {
  return /^whsec_/i.test(normalizeGeniusPayWebhookSecret(secret));
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

function payloadCandidates(rawPayload: string, parsedPayload?: unknown): string[] {
  const raw = rawPayload.replace(/^\uFEFF/, "");
  const candidates = [raw];
  if (parsedPayload !== undefined) {
    const serialized = JSON.stringify(parsedPayload);
    if (serialized !== raw) {
      candidates.push(serialized);
    }
  }
  return candidates;
}

function timestampCandidates(
  headerTimestamp: string,
  parsedPayload?: unknown
): string[] {
  const candidates = [headerTimestamp];
  if (
    parsedPayload &&
    typeof parsedPayload === "object" &&
    "timestamp" in parsedPayload
  ) {
    const bodyTs = String(
      (parsedPayload as { timestamp: unknown }).timestamp ?? ""
    ).trim();
    if (bodyTs && bodyTs !== headerTimestamp) {
      candidates.push(bodyTs);
    }
  }
  return candidates;
}

function assertTimestampFresh(timestamp: string): void {
  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) {
    throw new BadRequestException("Timestamp webhook GeniusPay invalide");
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > REPLAY_TOLERANCE_SEC) {
    throw new BadRequestException("Timestamp webhook GeniusPay expiré");
  }
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
  if (/^(sk_|pk_)/i.test(secret)) {
    throw new UnauthorizedException(
      `GENIUSPAY_WEBHOOK_SECRET semble être une clé API (sk_/pk_), pas le secret webhook whsec_…. ${WEBHOOK_SECRET_HINT}`
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

  assertTimestampFresh(timestamp);

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
      parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
    } catch {
      parsed = undefined;
    }
  }

  const payloads = payloadCandidates(raw, parsed);
  const timestamps = timestampCandidates(timestamp, parsed);

  for (const ts of timestamps) {
    for (const payload of payloads) {
      const expected = computeExpectedSignature(ts, payload, secret);
      if (safeCompareHex(expected, signature)) {
        return;
      }
    }
  }

  throw new UnauthorizedException(
    `Signature webhook GeniusPay invalide — le whsec_ sur Railway ne correspond probablement pas au webhook testé (recréez le webhook et recopiez le secret). ${WEBHOOK_SECRET_HINT}`
  );
}
