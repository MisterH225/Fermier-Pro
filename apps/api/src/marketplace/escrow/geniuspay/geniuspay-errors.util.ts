import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException
} from "@nestjs/common";

/** Messages utilisateur sans « 404 / not found » pour éviter le masquage côté mobile. */
export function throwGeniusPayUserError(params: {
  httpStatus: number;
  code?: string;
  message?: string;
  operation: "create" | "fetch";
}): never {
  const code = params.code?.trim().toUpperCase() ?? "";
  const providerMsg = params.message?.trim();

  switch (code) {
    case "INVALID_API_KEY":
    case "MISSING_API_KEY":
      throw new ServiceUnavailableException(
        "Paiement mobile money indisponible : clé GeniusPay invalide (utilisez pk_sandbox_ / pk_live_ dans GENIUSPAY_API_KEY)."
      );
    case "MERCHANT_INACTIVE":
      throw new ServiceUnavailableException(
        "Compte marchand GeniusPay inactif — contactez GeniusPay ou le support Fermier Pro."
      );
    case "COUNTRY_NOT_SUPPORTED":
      throw new BadRequestException(
        "Paiement mobile money refusé pour ce pays client (CI attendu)."
      );
    case "PAYMENT_INIT_FAILED":
    case "VALIDATION_ERROR":
      throw new BadRequestException(
        providerMsg
          ? `Paiement GeniusPay refusé : ${providerMsg}`
          : "Paiement GeniusPay refusé — vérifiez le montant et les informations client."
      );
    case "TRANSACTION_NOT_FOUND":
      throw new BadRequestException(
        params.operation === "create"
          ? "GeniusPay a refusé la création du paiement — réessayez dans un instant."
          : "Référence GeniusPay inconnue — relancez le paiement depuis l'application."
      );
    default:
      break;
  }

  if (params.httpStatus === 401 || params.httpStatus === 403) {
    throw new ServiceUnavailableException(
      "Paiement mobile money indisponible : identifiants GeniusPay refusés (vérifiez pk_ + sk_ sur Railway)."
    );
  }

  if (providerMsg) {
    throw new BadGatewayException(`Paiement GeniusPay refusé : ${providerMsg}`);
  }

  throw new BadGatewayException(
    params.operation === "create"
      ? "Impossible d'ouvrir le checkout GeniusPay pour ce paiement."
      : "Impossible de vérifier le paiement GeniusPay."
  );
}
