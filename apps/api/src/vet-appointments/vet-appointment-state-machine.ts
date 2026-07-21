import { VetAppointmentStatus } from "@prisma/client";

/**
 * Événements de transition du cycle RDV vétérinaire ↔ producteur.
 * Miroir des garde-fous métier de VetAppointmentService.
 */
export const VET_APPOINTMENT_EVENTS = [
  "VET_ACCEPT",
  "VET_REFUSE",
  "VET_PROPOSE",
  "PRODUCER_ACCEPT_FREE",
  "PRODUCER_ACCEPT_PAID",
  "PRODUCER_REFUSE",
  "PAYMENT_CONFIRMED",
  "PAYMENT_EXPIRED",
  "PROPOSAL_EXPIRED",
  "SERVICE_COMPLETED",
  "SERVICE_COMPLETED_FREE",
  "RATED",
  "CANCEL_BY_PRODUCER",
  "CANCEL_BY_VET"
] as const;

export type VetAppointmentEvent = (typeof VET_APPOINTMENT_EVENTS)[number];

export type VetAppointmentActor = "producer" | "vet" | "cron" | "system";

export interface VetAppointmentTransitionDefinition {
  from: VetAppointmentStatus;
  event: VetAppointmentEvent;
  to: VetAppointmentStatus;
  actors: readonly VetAppointmentActor[];
}

export interface VetAppointmentTransitionResult {
  allowed: boolean;
  to: VetAppointmentStatus | null;
}

export const VET_APPOINTMENT_TRANSITIONS: readonly VetAppointmentTransitionDefinition[] =
  [
    // Demande producteur → réponse vétérinaire
    {
      from: VetAppointmentStatus.APPOINTMENT_REQUESTED,
      event: "VET_ACCEPT",
      to: VetAppointmentStatus.AWAITING_PAYMENT,
      actors: ["vet"]
    },
    {
      from: VetAppointmentStatus.APPOINTMENT_REQUESTED,
      event: "VET_REFUSE",
      to: VetAppointmentStatus.APPOINTMENT_REFUSED,
      actors: ["vet"]
    },
    {
      from: VetAppointmentStatus.APPOINTMENT_REQUESTED,
      event: "CANCEL_BY_PRODUCER",
      to: VetAppointmentStatus.CANCELLED_BY_PRODUCER,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.APPOINTMENT_REQUESTED,
      event: "CANCEL_BY_VET",
      to: VetAppointmentStatus.CANCELLED_BY_VET,
      actors: ["vet"]
    },

    // Proposition vétérinaire → consentement producteur
    {
      from: VetAppointmentStatus.VISIT_PROPOSED,
      event: "PRODUCER_ACCEPT_FREE",
      to: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.VISIT_PROPOSED,
      event: "PRODUCER_ACCEPT_PAID",
      to: VetAppointmentStatus.AWAITING_PAYMENT,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.VISIT_PROPOSED,
      event: "PRODUCER_REFUSE",
      to: VetAppointmentStatus.REFUSED_BY_PRODUCER,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.VISIT_PROPOSED,
      event: "PROPOSAL_EXPIRED",
      to: VetAppointmentStatus.PAYMENT_EXPIRED,
      actors: ["cron"]
    },
    {
      from: VetAppointmentStatus.VISIT_PROPOSED,
      event: "CANCEL_BY_PRODUCER",
      to: VetAppointmentStatus.CANCELLED_BY_PRODUCER,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.VISIT_PROPOSED,
      event: "CANCEL_BY_VET",
      to: VetAppointmentStatus.CANCELLED_BY_VET,
      actors: ["vet"]
    },

    // Paiement
    {
      from: VetAppointmentStatus.AWAITING_PAYMENT,
      event: "PAYMENT_CONFIRMED",
      to: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.AWAITING_PAYMENT,
      event: "PAYMENT_EXPIRED",
      to: VetAppointmentStatus.PAYMENT_EXPIRED,
      actors: ["cron"]
    },
    {
      from: VetAppointmentStatus.AWAITING_PAYMENT,
      event: "PRODUCER_REFUSE",
      to: VetAppointmentStatus.REFUSED_BY_PRODUCER,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.AWAITING_PAYMENT,
      event: "CANCEL_BY_PRODUCER",
      to: VetAppointmentStatus.CANCELLED_BY_PRODUCER,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.AWAITING_PAYMENT,
      event: "CANCEL_BY_VET",
      to: VetAppointmentStatus.CANCELLED_BY_VET,
      actors: ["vet"]
    },

    // Prestation
    {
      from: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      event: "SERVICE_COMPLETED",
      to: VetAppointmentStatus.APPOINTMENT_COMPLETED,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      event: "SERVICE_COMPLETED_FREE",
      to: VetAppointmentStatus.APPOINTMENT_COMPLETED,
      actors: ["producer", "vet"]
    },
    {
      from: VetAppointmentStatus.APPOINTMENT_IN_PROGRESS,
      event: "SERVICE_COMPLETED",
      to: VetAppointmentStatus.APPOINTMENT_COMPLETED,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.APPOINTMENT_IN_PROGRESS,
      event: "SERVICE_COMPLETED_FREE",
      to: VetAppointmentStatus.APPOINTMENT_COMPLETED,
      actors: ["producer", "vet"]
    },
    {
      from: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      event: "CANCEL_BY_PRODUCER",
      to: VetAppointmentStatus.CANCELLED_BY_PRODUCER,
      actors: ["producer"]
    },
    {
      from: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      event: "CANCEL_BY_VET",
      to: VetAppointmentStatus.CANCELLED_BY_VET,
      actors: ["vet"]
    },

    // Notation
    {
      from: VetAppointmentStatus.APPOINTMENT_COMPLETED,
      event: "RATED",
      to: VetAppointmentStatus.APPOINTMENT_RATED,
      actors: ["producer"]
    }
  ];

const LEGAL_BY_KEY = new Map<string, VetAppointmentTransitionDefinition>();
for (const transition of VET_APPOINTMENT_TRANSITIONS) {
  LEGAL_BY_KEY.set(`${transition.from}::${transition.event}`, transition);
}

export function canTransition(
  from: VetAppointmentStatus,
  event: VetAppointmentEvent
): VetAppointmentTransitionResult {
  const legal = LEGAL_BY_KEY.get(`${from}::${event}`);
  if (!legal) {
    return { allowed: false, to: null };
  }
  return { allowed: true, to: legal.to };
}

export function assertTransition(
  from: VetAppointmentStatus,
  event: VetAppointmentEvent
): VetAppointmentStatus {
  const result = canTransition(from, event);
  if (!result.allowed || result.to == null) {
    throw new Error(
      `Transition interdite: ${from} + ${event}`
    );
  }
  return result.to;
}

export function getAllowedTransitions(
  from: VetAppointmentStatus
): readonly VetAppointmentTransitionDefinition[] {
  return VET_APPOINTMENT_TRANSITIONS.filter((t) => t.from === from);
}

/** Statuts avant visite en cours — annulables par les deux parties. */
export const CANCELLABLE_BEFORE_IN_PROGRESS: readonly VetAppointmentStatus[] = [
  VetAppointmentStatus.APPOINTMENT_REQUESTED,
  VetAppointmentStatus.VISIT_PROPOSED,
  VetAppointmentStatus.AWAITING_PAYMENT,
  VetAppointmentStatus.APPOINTMENT_CONFIRMED
];

export const TERMINAL_VET_APPOINTMENT_STATUSES: readonly VetAppointmentStatus[] =
  [
    VetAppointmentStatus.APPOINTMENT_RATED,
    VetAppointmentStatus.APPOINTMENT_REFUSED,
    VetAppointmentStatus.REFUSED_BY_PRODUCER,
    VetAppointmentStatus.PAYMENT_EXPIRED,
    VetAppointmentStatus.CANCELLED_BY_PRODUCER,
    VetAppointmentStatus.CANCELLED_BY_VET
  ];
