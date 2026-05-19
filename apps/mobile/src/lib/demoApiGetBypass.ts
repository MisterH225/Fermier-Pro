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

function queryParams(path: string): URLSearchParams {
  const q = path.indexOf("?");
  if (q === -1) {
    return new URLSearchParams();
  }
  return new URLSearchParams(path.slice(q + 1));
}

const DEMO_EXPENSE_CATEGORIES = [
  {
    id: "00000000-0000-4000-8000-0000000000c1",
    key: "feed",
    name: "Alimentation",
    icon: "🌾"
  },
  {
    id: "00000000-0000-4000-8000-0000000000c2",
    key: "health",
    name: "Santé",
    icon: "💊"
  },
  {
    id: "00000000-0000-4000-8000-0000000000c3",
    key: "equipment",
    name: "Équipements",
    icon: "🔧"
  },
  {
    id: "00000000-0000-4000-8000-0000000000c4",
    key: "transport",
    name: "Transport / logistique",
    icon: "🚚"
  }
] as const;

function demoFarmBudgetView(
  farmId: string,
  year: number,
  month: number
) {
  const now = new Date();
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.max(
    1,
    year === now.getUTCFullYear() && month === now.getUTCMonth() + 1
      ? now.getUTCDate()
      : dim
  );

  const lineIdByKey: Record<string, string> = {
    feed: "00000000-0000-4000-8000-0000000000b1",
    health: "00000000-0000-4000-8000-0000000000b2",
    equipment: "00000000-0000-4000-8000-0000000000b3",
    transport: "00000000-0000-4000-8000-0000000000b4"
  };

  const linesSpec = [
    { cat: DEMO_EXPENSE_CATEGORIES[0], planned: 150_000, realized: 81_000 },
    { cat: DEMO_EXPENSE_CATEGORIES[1], planned: 50_000, realized: 56_000 },
    { cat: DEMO_EXPENSE_CATEGORIES[2], planned: 80_000, realized: 32_000 },
    { cat: DEMO_EXPENSE_CATEGORIES[3], planned: 40_000, realized: 18_000 }
  ];

  const lines = linesSpec.map(({ cat, planned, realized }) => {
    const projected = Math.round((realized / day) * dim);
    const pct = planned > 0 ? (realized / planned) * 100 : 0;
    const projPct = planned > 0 ? (projected / planned) * 100 : 0;
    const status =
      pct > 100 ? "exceeded" : pct >= 80 ? "warning" : ("ok" as const);
    const projectedStatus =
      projPct > 100 ? "exceeded" : projPct >= 80 ? "warning" : ("ok" as const);
    return {
      budgetLineId: lineIdByKey[cat.key] ?? null,
      categoryId: cat.id,
      categoryKey: cat.key,
      categoryName: cat.name,
      categoryIcon: cat.icon,
      amountPlanned: String(planned),
      amountRealized: String(realized),
      amountProjected: String(projected),
      consumptionPct: Math.round(pct * 10) / 10,
      projectedConsumptionPct: Math.round(projPct * 10) / 10,
      remaining: String(planned - realized),
      status,
      projectedStatus,
      currency: "XOF"
    };
  });

  const totalPlanned = linesSpec.reduce((s, l) => s + l.planned, 0);
  const totalRealized = linesSpec.reduce((s, l) => s + l.realized, 0);
  const totalProjected = lines.reduce(
    (s, l) => s + Number(l.amountProjected),
    0
  );
  const globalPct =
    totalPlanned > 0 ? (totalRealized / totalPlanned) * 100 : 0;

  return {
    farmId,
    year,
    month,
    configured: true,
    budgetId: "00000000-0000-4000-8000-0000000000b1",
    currency: "XOF",
    currencySymbol: "FCFA",
    createdFrom: "manual",
    global: {
      totalPlanned: String(totalPlanned),
      totalRealized: String(totalRealized),
      totalProjected: String(totalProjected),
      remaining: String(totalPlanned - totalRealized),
      consumptionPct: Math.round(globalPct * 10) / 10,
      status:
        globalPct > 100
          ? "exceeded"
          : globalPct >= 80
            ? "warning"
            : "on_track",
      deltaProjected: String(totalProjected - totalPlanned),
      projectedEndOfMonth: String(totalProjected)
    },
    lines,
    suggestions: [
      {
        id: "00000000-0000-4000-8000-0000000000s1",
        type: "category_exceeded_twice",
        message:
          "Budget Santé depasse 2 mois de suite — augmenter a 59000 FCFA ?",
        actionPayload: {
          action: "set_line_amount",
          categoryId: DEMO_EXPENSE_CATEGORIES[1].id,
          amountPlanned: 59_000
        },
        isApplied: false,
        isDismissed: false,
        createdAt: ISO
      }
    ]
  };
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
      const d = new Date(Date.UTC(2025, 10 + i, 15));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    };
    const months6 = [0, 1, 2, 3, 4, 5].map((i) => ({
      month: mk(i),
      expenses: String(80000 + i * 12000),
      revenues: String(170000 + i * 8000),
      currency: "XOF"
    }));
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
      months6,
      months3: months6.slice(-3)
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
    const farmId = DEMO_PREVIEW_FARM_ID;
    return [
      ...DEMO_EXPENSE_CATEGORIES.map((c) => ({
        id: c.id,
        farmId,
        type: "expense",
        key: c.key,
        name: c.name,
        icon: c.icon,
        isDefault: true
      })),
      {
        id: "00000000-0000-4000-8000-0000000000c5",
        farmId,
        type: "income",
        key: "animal_sales",
        name: "Ventes animaux",
        icon: "🐷",
        isDefault: true
      }
    ];
  }

  const mFinBudget = /^\/farms\/([^/]+)\/finance\/budget$/.exec(p);
  if (mFinBudget) {
    const farmId = mFinBudget[1];
    const qs = queryParams(path);
    const year = Number(qs.get("year")) || 2026;
    const month = Number(qs.get("month")) || 5;
    return demoFarmBudgetView(farmId, year, month);
  }

  const mFinBudgetHist =
    /^\/farms\/([^/]+)\/finance\/budget\/category-history$/.exec(p);
  if (mFinBudgetHist) {
    const qs = queryParams(path);
    const categoryId = qs.get("categoryId") ?? "";
    return {
      categoryId,
      points: [
        { year: 2026, month: 2, expenses: "78000" },
        { year: 2026, month: 3, expenses: "92000" },
        { year: 2026, month: 4, expenses: "85000" }
      ],
      averageExpenses: "85000"
    };
  }

  const mFinBudgetSim = /^\/farms\/([^/]+)\/finance\/budget\/simulate$/.exec(p);
  if (mFinBudgetSim) {
    const farmId = mFinBudgetSim[1];
    const qs = queryParams(path);
    const year = Number(qs.get("year")) || 2026;
    const month = Number(qs.get("month")) || 5;
    const base = demoFarmBudgetView(farmId, year, month);
    const categoryId = qs.get("categoryId") ?? "";
    const newAmount = Number(qs.get("newAmount")) || 0;
    const lines = base.lines.map((l) =>
      l.categoryId === categoryId
        ? { ...l, amountPlanned: String(newAmount) }
        : l
    );
    const totalPlanned = lines.reduce(
      (s, l) => s + Number(l.amountPlanned),
      0
    );
    const totalRealized = Number(base.global.totalRealized);
    const totalProjected = lines.reduce(
      (s, l) => s + Number(l.amountProjected),
      0
    );
    const globalPct =
      totalPlanned > 0 ? (totalRealized / totalPlanned) * 100 : 0;
    return {
      categoryId,
      newAmount: String(newAmount),
      global: {
        ...base.global,
        totalPlanned: String(totalPlanned),
        totalProjected: String(totalProjected),
        remaining: String(totalPlanned - totalRealized),
        consumptionPct: Math.round(globalPct * 10) / 10,
        status:
          globalPct > 100
            ? "exceeded"
            : globalPct >= 80
              ? "warning"
              : "on_track",
        previousTotalPlanned: base.global.totalPlanned,
        marginAvailable: String(totalPlanned - totalRealized)
      },
      lines
    };
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
    const farmId = /^\/farms\/([^/]+)\/animals$/.exec(p)?.[1] ?? "demo";
    return [
      {
        id: "00000000-0000-4000-8000-0000000000a1",
        publicId: "PORC-001",
        tagCode: "PORC-001",
        sex: "female",
        status: "active",
        species: demoSpecies,
        breed: null,
        weights: [{ weightKg: 82.5, measuredAt: new Date().toISOString() }],
        currentPen: {
          placementId: "demo-pl-1",
          penId: "demo-pen-1",
          penName: "Loge A1",
          barnId: "demo-barn-1",
          barnName: "Bâtiment 1"
        }
      },
      {
        id: "00000000-0000-4000-8000-0000000000a2",
        publicId: "PORC-002",
        tagCode: "PORC-002",
        sex: "male",
        status: "active",
        species: demoSpecies,
        breed: null,
        weights: [{ weightKg: 95, measuredAt: new Date().toISOString() }],
        currentPen: null
      }
    ];
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

  if (/^\/farms\/[^/]+\/tasks\/summary$/.test(p)) {
    return { pendingCount: 0, inProgressCount: 0, doneCount: 0 };
  }

  if (/^\/farms\/[^/]+\/tasks\/my-dashboard$/.test(p)) {
    return { items: [], total: 0 };
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
    const farmId = /^\/farms\/([^/]+)\/members$/.exec(p)?.[1] ?? "demo";
    const uid = DEMO_AUTH_ME.user.id;
    return [
      {
        id: "00000000-0000-4000-8000-0000000000e1",
        farmId,
        userId: uid,
        role: "owner",
        user: {
          id: uid,
          fullName: DEMO_AUTH_ME.user.fullName ?? "Explorateur démo",
          email: DEMO_AUTH_ME.user.email,
          phone: null
        }
      },
      {
        id: "00000000-0000-4000-8000-0000000000e2",
        farmId,
        userId: "00000000-0000-4000-8000-000000000099",
        role: "technician",
        user: {
          id: "00000000-0000-4000-8000-000000000099",
          fullName: "Technicien démo",
          email: "tech.demo@fermier.local",
          phone: null
        }
      }
    ];
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
        totalHeadcount: 144,
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
        barnCount: 2,
        availablePensCount: 5,
        unassignedAnimalsCount: 3
      },
      categoryBreakdown: [
        { key: "piglets", count: 40 },
        { key: "growth", count: 50 },
        { key: "finishing", count: 30 },
        { key: "breeders", count: 12 }
      ],
      headcountTrend: (() => {
        const rows: { month: string; total: number }[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const d = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
          );
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          rows.push({ month: key, total: 100 + i * 4 });
        }
        return rows;
      })()
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

  const mCheptelPens = /^\/farms\/([^/]+)\/cheptel\/pens$/.exec(p);
  if (mCheptelPens) {
    return {
      barns: [{ id: "demo-barn-1", name: "Bâtiment 1" }],
      pens: [
        {
          id: "demo-pen-1",
          name: "Loge A1",
          code: null,
          barnId: "demo-barn-1",
          barnName: "Bâtiment 1",
          capacity: 12,
          occupancy: 8,
          occupancyRate: 66.7,
          borderStatus: "healthy",
          batchTypeTag: "starter",
          sanitaryTag: "healthy"
        },
        {
          id: "demo-pen-2",
          name: "Loge A2",
          code: null,
          barnId: "demo-barn-1",
          barnName: "Bâtiment 1",
          capacity: 12,
          occupancy: 12,
          occupancyRate: 100,
          borderStatus: "critical",
          batchTypeTag: "fattening",
          sanitaryTag: "overcrowded"
        }
      ]
    };
  }

  if (/^\/farms\/[^/]+\/cheptel\/history$/.test(p)) {
    return [];
  }

  if (/^\/farms\/[^/]+\/cheptel\/gmq\/summary$/.test(p)) {
    return { animals: [], settings: [] };
  }

  if (/^\/farms\/[^/]+\/cheptel\/weight-series$/.test(p)) {
    return [];
  }

  if (p === "/onboarding/status") {
    return { isOnboarded: true, onboardingSkipped: false };
  }

  if (p === "/taxonomy") {
    return [
      {
        id: demoSpecies.id,
        code: "porcin",
        name: "Porcin",
        breeds: [
          { id: "00000000-0000-4000-8000-0000000000b1", name: "Large White" },
          { id: "00000000-0000-4000-8000-0000000000b2", name: "Landrace" },
          { id: "00000000-0000-4000-8000-0000000000b3", name: "Duroc" }
        ]
      }
    ];
  }

  return null;
}

/** Réponses factices POST / PUT / PATCH en mode démo (budget, etc.). */
export function tryDemoBypassApiWriteJson(
  method: "POST" | "PUT" | "PATCH",
  path: string,
  body: unknown,
  accessToken: string
): unknown | null {
  if (!isDemoBypassToken(accessToken)) {
    return null;
  }
  const p = normPath(path);
  const qs = queryParams(path);
  const payload = body as Record<string, unknown> | null;

  if (method === "POST" && p === "/onboarding/skip") {
    return { isOnboarded: false, onboardingSkipped: true };
  }

  if (method === "POST" && p === "/onboarding/complete") {
    return {
      isOnboarded: true,
      onboardingSkipped: false,
      farm: {
        id: DEMO_PREVIEW_FARM_ID,
        name: String(payload?.farmName ?? "Ferme démo")
      }
    };
  }

  const mBudgetPost = /^\/farms\/([^/]+)\/finance\/budget$/.exec(p);
  if (method === "POST" && mBudgetPost) {
    const farmId = mBudgetPost[1];
    const year = Number(payload?.year ?? qs.get("year")) || 2026;
    const month = Number(payload?.month ?? qs.get("month")) || 5;
    return demoFarmBudgetView(farmId, year, month);
  }

  if (method === "POST" && /^\/farms\/([^/]+)\/finance\/budget\/copy-previous$/.test(p)) {
    const farmId = /^\/farms\/([^/]+)\/finance\/budget\/copy-previous$/.exec(p)![1];
    const year = Number(qs.get("year")) || 2026;
    const month = Number(qs.get("month")) || 5;
    return demoFarmBudgetView(farmId, year, month);
  }

  if (method === "POST" && /^\/farms\/([^/]+)\/finance\/budget\/suggestion-auto$/.test(p)) {
    const farmId =
      /^\/farms\/([^/]+)\/finance\/budget\/suggestion-auto$/.exec(p)![1];
    const year = Number(qs.get("year")) || 2026;
    const month = Number(qs.get("month")) || 5;
    return demoFarmBudgetView(farmId, year, month);
  }

  if (method === "PUT" && /^\/farms\/([^/]+)\/finance\/budget-lines\/[^/]+$/.test(p)) {
    const farmId = /^\/farms\/([^/]+)\/finance\/budget-lines\/[^/]+$/.exec(p)![1];
    return demoFarmBudgetView(farmId, 2026, 5);
  }

  const mPatchSug =
    /^\/farms\/([^/]+)\/finance\/budget-suggestions\/[^/]+$/.exec(p);
  if (method === "PATCH" && mPatchSug) {
    return demoFarmBudgetView(mPatchSug[1], 2026, 5);
  }

  return null;
}
