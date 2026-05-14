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
    housingBuildingsCount: null,
    housingPensPerBuilding: null,
    housingMaxPigsPerPen: null,
    createdAt: ISO,
    updatedAt: ISO,
    effectiveScopes: [
      "farm.read",
      "farm.write",
      "livestock.read",
      "livestock.write",
      "health.read",
      "tasks.read",
      "finance.read",
      "housing.read",
      "feedStock.read",
      "vet.read",
      "exits.read",
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

  const mDefaultInv = /^\/farms\/([^/]+)\/invitations\/default$/.exec(p);
  if (mDefaultInv) {
    const farmId = mDefaultInv[1];
    return {
      id: "00000000-0000-4000-8000-0000000000d1",
      farmId,
      token: "fermier-demo-default-invite-token",
      expiresAt: "2027-12-31T23:59:59.000Z",
      isDefault: true,
      kind: "share_link",
      status: "pending"
    };
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
      currency: "XOF",
      currencySymbol: "FCFA"
    };
  }

  const mFinOverview = /^\/farms\/([^/]+)\/finance\/overview$/.exec(p);
  if (mFinOverview) {
    const farmId = mFinOverview[1];
    const mk = (i: number) => {
      const d = new Date(Date.UTC(2026, 2 + i, 15));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    };
    return {
      farmId,
      settings: {
        currencyCode: "XOF",
        currencySymbol: "FCFA",
        lowBalanceThreshold: null
      },
      month: {
        totalExpenses: "95000",
        totalRevenues: "210000",
        netMargin: "115000"
      },
      balanceAllTime: "50000",
      lowBalanceWarning: false,
      months3: [
        { month: mk(0), expenses: "120000", revenues: "180000", currency: "XOF" },
        { month: mk(1), expenses: "95000", revenues: "210000", currency: "XOF" },
        { month: mk(2), expenses: "140000", revenues: "195000", currency: "XOF" }
      ]
    };
  }

  const mFinSettings = /^\/farms\/([^/]+)\/finance\/settings$/.exec(p);
  if (mFinSettings) {
    const farmId = mFinSettings[1];
    return {
      farmId,
      currencyCode: "XOF",
      currencySymbol: "FCFA",
      lowBalanceThreshold: null
    };
  }

  if (/^\/farms\/[^/]+\/finance\/categories$/.test(p)) {
    return [];
  }

  if (/^\/farms\/[^/]+\/finance\/transactions$/.test(p)) {
    return [];
  }

  const mFinReport = /^\/farms\/([^/]+)\/finance\/report$/.exec(p);
  if (mFinReport) {
    const farmId = mFinReport[1];
    return {
      farmId,
      period: "month",
      range: { start: ISO, end: ISO },
      currency: "XOF",
      currencySymbol: "FCFA",
      totals: { expenses: "0", revenues: "0", net: "0" },
      byCategory: []
    };
  }

  const mFinProj = /^\/farms\/([^/]+)\/finance\/projection$/.exec(p);
  if (mFinProj) {
    const farmId = mFinProj[1];
    return {
      farmId,
      currency: "XOF",
      basedOnMonths: 6,
      nextMonths: [
        {
          monthOffset: 1,
          projectedExpenses: "100000",
          projectedRevenues: "200000",
          projectedNet: "100000"
        },
        {
          monthOffset: 2,
          projectedExpenses: "100000",
          projectedRevenues: "200000",
          projectedNet: "100000"
        },
        {
          monthOffset: 3,
          projectedExpenses: "100000",
          projectedRevenues: "200000",
          projectedNet: "100000"
        }
      ],
      deficitAlert: false
    };
  }

  const mFinMargin = /^\/farms\/([^/]+)\/finance\/margin-by-batch$/.exec(p);
  if (mFinMargin) {
    const farmId = mFinMargin[1];
    return {
      farmId,
      batchId: "demo-batch",
      batchName: "Bande démo",
      headcount: 10,
      revenues: "0",
      expensesAllocated: "0",
      grossMargin: "0",
      costPerHead: "0",
      costPerKg: null
    };
  }

  const mFinSim = /^\/farms\/([^/]+)\/finance\/simulation$/.exec(p);
  if (mFinSim) {
    const farmId = mFinSim[1];
    return {
      farmId,
      currentBalance: "0",
      simulatedAdditionalRevenue: "0",
      projectedBalance: "0"
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

  if (/^\/farms\/[^/]+\/activity-logs/.test(p)) {
    return { items: [], nextCursor: undefined };
  }

  if (/^\/farms\/[^/]+\/feed-stock-lots$/.test(p)) {
    return [];
  }

  if (/^\/farms\/[^/]+\/alerts\/count$/.test(p)) {
    const farmId = /^\/farms\/([^/]+)\//.exec(p)?.[1] ?? "demo";
    return { farmId, criticalUnread: 0 };
  }
  if (/^\/farms\/[^/]+\/alerts(\?|$)/.test(p)) {
    const farmId = /^\/farms\/([^/]+)\/alerts/.exec(p)?.[1] ?? "demo";
    return { farmId, items: [] };
  }

  if (/^\/farms\/[^/]+\/feed\/(types|overview|chart|stats|movements)/.test(p)) {
    const mOv = /^\/farms\/([^/]+)\/feed\/overview$/.exec(p);
    if (mOv) {
      return {
        farmId: mOv[1],
        totalStockKg: "480",
        types: [
          {
            id: "demo-ft-1",
            farmId: mOv[1],
            name: "Aliment démarrage",
            unit: "sac",
            lowStockThresholdDays: 15,
            color: "#2D6A4F",
            weightPerBagKg: "25",
            bagCountCurrent: "8",
            lastCheckDate: new Date().toISOString(),
            currentStockKg: "200",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: "demo-ft-2",
            farmId: mOv[1],
            name: "Aliment croissance",
            unit: "sac",
            lowStockThresholdDays: 15,
            color: "#5C6B7A",
            weightPerBagKg: "25",
            bagCountCurrent: "5",
            lastCheckDate: new Date().toISOString(),
            currentStockKg: "125",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      };
    }
    if (/\/feed\/types$/.test(p)) {
      const farmId = /^\/farms\/([^/]+)\//.exec(p)?.[1] ?? "demo";
      return [
        {
          id: "demo-ft-1",
          farmId,
          name: "Aliment démarrage",
          unit: "sac",
          lowStockThresholdDays: 15,
          color: "#2D6A4F",
          weightPerBagKg: "25",
          bagCountCurrent: "8",
          lastCheckDate: new Date().toISOString(),
          currentStockKg: "200",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
    }
    const mChart = /^\/farms\/([^/]+)\/feed\/chart/.exec(p);
    if (mChart) {
      const farmId = mChart[1];
      const monthKeys = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
      return {
        farmId,
        periodMonths: 6,
        monthKeys,
        series: [
          {
            feedTypeId: "demo-ft-1",
            name: "Démarrage",
            color: "#2D6A4F",
            points: [120, 140, 160, 180, 190, 200]
          },
          {
            feedTypeId: "demo-ft-2",
            name: "Croissance",
            color: "#5C6B7A",
            points: [200, 190, 170, 155, 140, 125]
          }
        ]
      };
    }
    if (/\/feed\/stats$/.test(p)) {
      const farmId = /^\/farms\/([^/]+)\//.exec(p)?.[1] ?? "demo";
      return {
        farmId,
        items: [
          {
            feedTypeId: "demo-ft-1",
            name: "Aliment démarrage",
            color: "#2D6A4F",
            currentStockKg: "200",
            weightPerBagKg: "25",
            bagCountCurrent: "8",
            lastCheckDate: new Date().toISOString(),
            avgDailyConsumptionKg: "2.5",
            daysRemaining: 80,
            estimatedDepletionDate: "2026-08-01",
            status: "ok"
          },
          {
            feedTypeId: "demo-ft-2",
            name: "Aliment croissance",
            color: "#5C6B7A",
            currentStockKg: "125",
            weightPerBagKg: "25",
            bagCountCurrent: "5",
            lastCheckDate: new Date().toISOString(),
            avgDailyConsumptionKg: "4.2",
            daysRemaining: 22,
            estimatedDepletionDate: "2026-06-05",
            status: "warning"
          }
        ]
      };
    }
    if (/\/feed\/movements/.test(p)) {
      return [];
    }
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

  const mCheptel = /^\/farms\/([^/]+)\/cheptel$/.exec(p);
  if (mCheptel) {
    const farmId = mCheptel[1];
    const base = demoFarm(farmId);
    return {
      farm: {
        id: base.id,
        name: base.name,
        livestockMode: base.livestockMode,
        housingBuildingsCount: 2,
        housingPensPerBuilding: 8,
        housingMaxPigsPerPen: 12
      },
      kpis: {
        totalAnimals: 24,
        maleAnimals: 2,
        femaleAnimals: 10,
        unknownSexAnimals: 0,
        gestatingFemales: 3,
        totalBatchHeadcount: 120,
        activeBatchesCount: 4,
        closedBatchesCount: 1,
        penCapacityTotal: 192,
        penOccupancyHeadcount: 140,
        occupancyRate: 72.9,
        barnCount: 2
      }
    };
  }

  if (/^\/farms\/[^/]+\/cheptel\/status-logs/.test(p)) {
    return [];
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
      offers: [],
      healthSnapshot: {
        vaccinesUpToDate: true,
        lastVaccinationAt: ISO,
        lastVetVisitAt: ISO,
        lastVetReason: "Visite de routine",
        recentDiseaseSummary: null,
        mortalityRate30dPct: "1.20"
      },
      farmRatingSummary: { avg: 4.5, count: 8 }
    };
  }

  if (p === "/marketplace/listings") {
    const ISO = new Date().toISOString();
    return [
      {
        id: "demo-listing-market-1",
        title: "Lot porcelets croissance",
        description: "Exemple UI (mode démo).",
        unitPrice: null,
        quantity: null,
        currency: "XOF",
        locationLabel: "Bouaké, CIV",
        status: "published",
        publishedAt: ISO,
        pickupAt: null,
        pickupNote: null,
        createdAt: ISO,
        updatedAt: ISO,
        category: "piglet",
        photoUrls: [],
        animalIds: [],
        totalWeightKg: "320",
        pricePerKg: "1200",
        totalPrice: "384000",
        breedLabel: "Large White x Landrace",
        viewsCount: 24,
        consultationsCount: 5,
        expiresAt: null,
        farm: { id: DEMO_PREVIEW_FARM_ID, name: "Ferme démo (aperçu)" },
        animal: null,
        seller: { id: "demo-seller", fullName: "Producteur démo" }
      }
    ];
  }

  if (p === "/marketplace/offers") {
    return [];
  }

  const mDashFin = /^\/farms\/([^/]+)\/dashboard\/finance-timeseries$/.exec(p);
  if (mDashFin) {
    const farmId = mDashFin[1];
    const mk = (i: number) => {
      const d = new Date(Date.UTC(2026, 2 + i, 15));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    };
    return {
      farmId,
      months: [
        { month: mk(0), expenses: "120000", revenues: "180000", currency: "XOF" },
        { month: mk(1), expenses: "95000", revenues: "210000", currency: "XOF" },
        { month: mk(2), expenses: "140000", revenues: "195000", currency: "XOF" }
      ]
    };
  }

  const mDashGest = /^\/farms\/([^/]+)\/dashboard\/gestations$/.exec(p);
  if (mDashGest) {
    const farmId = mDashGest[1];
    const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    return {
      farmId,
      items: [
        {
          animalId: "00000000-0000-4000-8000-0000000000a1",
          label: "TRUIE-DEMO-01",
          expectedFarrowingAt: due.toISOString(),
          daysRemaining: 2,
          urgent: true
        }
      ]
    };
  }

  const mDashHealth = /^\/farms\/([^/]+)\/dashboard\/health$/.exec(p);
  if (mDashHealth) {
    const farmId = mDashHealth[1];
    const vDue = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    return {
      farmId,
      upcomingVaccines: [
        {
          taskId: "00000000-0000-4000-8000-0000000000b1",
          title: "Vaccin porcin démo",
          dueAt: vDue.toISOString(),
          animalHint: "Bande démo"
        }
      ],
      nextVetConsultation: {
        id: "00000000-0000-4000-8000-0000000000c1",
        subject: "Visite de routine",
        openedAt: new Date().toISOString(),
        status: "open"
      },
      activeDiseaseCases: {
        count: 1,
        byType: [{ title: "Toux sèche", count: 1 }]
      },
      mortalityRate30d: "0.0100",
      mortalityWindowDays: 30
    };
  }

  const mDashFeed = /^\/farms\/([^/]+)\/dashboard\/feed-stock$/.exec(p);
  if (mDashFeed) {
    const farmId = mDashFeed[1];
    return {
      farmId,
      items: [
        {
          productName: "Céréales démo",
          remainingKg: "120",
          initialKg: "500",
          ratio: 0.24,
          level: "medium",
          critical: false,
          color: "#2D6A4F"
        },
        {
          productName: "Complément démo",
          remainingKg: "30",
          initialKg: "200",
          ratio: 0.15,
          level: "critical",
          critical: true,
          color: "#B45309"
        }
      ]
    };
  }

  const mFarmHealthOverview = /^\/farms\/([^/]+)\/health\/overview$/.exec(p);
  if (mFarmHealthOverview) {
    const farmId = mFarmHealthOverview[1];
    return {
      farmId,
      activeDiseaseCount: 0,
      nextVaccine: null,
      nextVetVisitModule: null,
      nextVetConsultationLegacy: null,
      mortalityRate30d: "0.0000"
    };
  }

  const mFarmHealthUpcoming = /^\/farms\/([^/]+)\/health\/upcoming$/.exec(p);
  if (mFarmHealthUpcoming) {
    const farmId = mFarmHealthUpcoming[1];
    return {
      farmId,
      vaccines: [],
      vetVisits: []
    };
  }

  const mFarmHealthMort = /^\/farms\/([^/]+)\/health\/mortality-rate$/.exec(p);
  if (mFarmHealthMort) {
    const farmId = mFarmHealthMort[1];
    return {
      farmId,
      periodDays: 30,
      headcountLost: 0,
      rate: "0"
    };
  }

  const mFarmHealthEvents = /^\/farms\/([^/]+)\/health\/events$/.exec(p);
  if (mFarmHealthEvents) {
    return [];
  }

  return null;
}
