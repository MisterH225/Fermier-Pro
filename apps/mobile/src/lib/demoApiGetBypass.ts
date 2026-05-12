import {
  DEMO_AUTH_ME,
  DEMO_PREVIEW_FARM_ID,
  isDemoBypassToken
} from "./demoBypass";

const ISO = "2026-01-01T00:00:00.000Z";

const demoSpecies = {
  id: "00000000-0000-4000-8000-000000000020",
  code: "PORC",
  name: "Porc"
};

function normPath(path: string): string {
  let p = path.startsWith("/") ? path : `/${path}`;
  const q = p.indexOf("?");
  if (q !== -1) {
    p = p.slice(0, q);
  }
  return p;
}

function demoFarm(farmId: string) {
  return {
    id: farmId,
    name: "Ferme démo (aperçu UI)",
    ownerId: DEMO_AUTH_ME.user.id,
    speciesFocus: "porc",
    livestockMode: "individual",
    address: null,
    capacity: 100,
    latitude: null,
    longitude: null,
    createdAt: ISO,
    updatedAt: ISO,
    effectiveScopes: [
      "farm.read",
      "farm.write",
      "livestock.read",
      "livestock.write",
      "tasks.read",
      "finance.read",
      "housing.read",
      "feedStock.read",
      "vet.read",
      "marketplace.read"
    ]
  };
}

/**
 * Réponses GET factices pour le jeton mode démo (aucun appel réseau).
 * Retourne `null` pour laisser passer vers le fetch réel (ex. route non gérée).
 */
export function tryDemoBypassApiGetJson(
  path: string,
  accessToken: string
): unknown | null {
  if (!isDemoBypassToken(accessToken)) {
    return null;
  }
  const p = normPath(path);
  const uid = DEMO_AUTH_ME.user.id;

  if (p === "/farms") {
    return [demoFarm(DEMO_PREVIEW_FARM_ID)];
  }

  const mFinExp = /^\/farms\/([^/]+)\/finance\/expenses\/([^/]+)$/.exec(p);
  if (mFinExp) {
    const farmId = mFinExp[1];
    const expenseId = mFinExp[2];
    return {
      id: expenseId,
      farmId,
      amount: "0",
      currency: "XOF",
      label: "Dépense démo",
      category: null,
      note: null,
      occurredAt: ISO,
      createdByUserId: uid
    };
  }

  const mFinRev = /^\/farms\/([^/]+)\/finance\/revenues\/([^/]+)$/.exec(p);
  if (mFinRev) {
    const farmId = mFinRev[1];
    const revenueId = mFinRev[2];
    return {
      id: revenueId,
      farmId,
      amount: "0",
      currency: "XOF",
      label: "Revenu démo",
      category: null,
      note: null,
      occurredAt: ISO,
      createdByUserId: uid
    };
  }

  const mFinSummary = /^\/farms\/([^/]+)\/finance\/summary$/.exec(p);
  if (mFinSummary) {
    const farmId = mFinSummary[1];
    return {
      farmId,
      totalExpenses: "0",
      totalRevenues: "0",
      net: "0",
      currency: "XOF"
    };
  }

  if (/^\/farms\/[^/]+\/finance\/expenses$/.test(p)) {
    return [];
  }
  if (/^\/farms\/[^/]+\/finance\/revenues$/.test(p)) {
    return [];
  }

  const mAnimal = /^\/farms\/([^/]+)\/animals\/([^/]+)$/.exec(p);
  if (mAnimal) {
    const animalId = mAnimal[2];
    return {
      id: animalId,
      publicId: "DEMO-001",
      tagCode: null,
      sex: "unknown",
      birthDate: null,
      status: "active",
      notes: null,
      species: demoSpecies,
      breed: null,
      weights: []
    };
  }

  if (/^\/farms\/[^/]+\/animals$/.test(p)) {
    return [];
  }

  const mBatchHealth = /^\/farms\/([^/]+)\/batches\/([^/]+)\/health-events$/.exec(
    p
  );
  if (mBatchHealth) {
    return [];
  }

  const mBatch = /^\/farms\/([^/]+)\/batches\/([^/]+)$/.exec(p);
  if (mBatch) {
    const batchId = mBatch[2];
    return {
      id: batchId,
      name: "Lot démo",
      headcount: 0,
      status: "active",
      notes: null,
      species: demoSpecies,
      breed: null,
      weights: []
    };
  }

  if (/^\/farms\/[^/]+\/batches$/.test(p)) {
    return [];
  }

  if (/^\/farms\/[^/]+\/tasks$/.test(p)) {
    return [];
  }

  const mVetDetail = /^\/farms\/([^/]+)\/vet-consultations\/([^/]+)$/.exec(p);
  if (mVetDetail) {
    const farmId = mVetDetail[1];
    const consultationId = mVetDetail[2];
    return {
      id: consultationId,
      farmId,
      animalId: null,
      subject: "Consultation démo",
      summary: null,
      status: "open",
      openedAt: ISO,
      closedAt: null,
      openedBy: { id: uid, fullName: "Explorateur démo", email: null },
      primaryVet: null,
      attachments: [],
      animal: null
    };
  }

  if (/^\/farms\/[^/]+\/vet-consultations$/.test(p)) {
    return [];
  }

  if (/^\/farms\/[^/]+\/members$/.test(p)) {
    return [];
  }

  if (/^\/farms\/[^/]+\/invitations$/.test(p)) {
    return [];
  }

  if (/^\/farms\/[^/]+\/feed-stock-lots$/.test(p)) {
    return [];
  }

  const mBarnDetail = /^\/farms\/([^/]+)\/barns\/([^/]+)$/.exec(p);
  if (mBarnDetail) {
    const farmId = mBarnDetail[1];
    const barnId = mBarnDetail[2];
    return {
      id: barnId,
      farmId,
      name: "Loge démo",
      code: null,
      notes: null,
      sortOrder: 0,
      pens: []
    };
  }

  if (/^\/farms\/[^/]+\/barns$/.test(p)) {
    return [];
  }

  const mPen = /^\/farms\/([^/]+)\/pens\/([^/]+)$/.exec(p);
  if (mPen) {
    const farmId = mPen[1];
    const barnId = "00000000-0000-4000-8000-0000000000e1";
    const penId = mPen[2];
    return {
      id: penId,
      barnId,
      name: "Case démo",
      code: null,
      zoneLabel: null,
      capacity: null,
      status: "active",
      sortOrder: 0,
      barn: { id: barnId, name: "Loge démo", farmId },
      placements: [],
      logs: []
    };
  }

  const mFarmOnly = /^\/farms\/([^/]+)$/.exec(p);
  if (mFarmOnly) {
    return demoFarm(mFarmOnly[1]);
  }

  if (p === "/chat/rooms") {
    return [];
  }

  if (/^\/chat\/rooms\/[^/]+\/messages$/.test(p)) {
    return [];
  }

  if (p.startsWith("/chat/directory/users")) {
    return [];
  }

  const mListing = /^\/marketplace\/listings\/([^/]+)$/.exec(p);
  if (mListing) {
    const listingId = mListing[1];
    return {
      id: listingId,
      sellerUserId: uid,
      title: "Annonce démo",
      description: "Contenu factice (mode démo, sans API).",
      unitPrice: null,
      quantity: null,
      currency: "XOF",
      locationLabel: null,
      status: "draft",
      publishedAt: null,
      pickupAt: null,
      pickupNote: null,
      createdAt: ISO,
      updatedAt: ISO,
      farm: { id: DEMO_PREVIEW_FARM_ID, name: "Ferme démo (aperçu UI)" },
      animal: null,
      seller: { id: uid, fullName: "Explorateur démo", email: "demo@fermier-pro.local" },
      myOffers: [],
      offers: []
    };
  }

  if (p === "/marketplace/listings") {
    return [];
  }

  if (p === "/marketplace/offers") {
    return [];
  }

  return null;
}
