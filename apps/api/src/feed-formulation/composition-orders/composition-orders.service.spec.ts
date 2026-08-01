import { BadRequestException } from "@nestjs/common";
import { CompositionOrderStatus } from "@prisma/client";
import { CompositionOrdersService } from "./composition-orders.service";

describe("CompositionOrdersService", () => {
  const producer = { id: "prod-1" } as never;
  const millUser = { id: "mill-user" } as never;

  type OrderRow = {
    id: string;
    savedCompositionId: string;
    farmId: string;
    producerUserId: string;
    millProfileId: string;
    status: CompositionOrderStatus;
    snapshotRation: Array<{
      feedIngredientId: string;
      canonicalName: string;
      quantityKg: number;
      proportionPct: number;
      costContribution: number;
    }>;
    quotedPriceXof: number;
    finalPriceXof: number | null;
    millNote: string | null;
    productionStartEstimate: Date | null;
    readyEstimate: Date | null;
    productionStartedAt: Date | null;
    readyActual: Date | null;
    escrowTransactionRef: string | null;
    deadlineAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };

  const baseOrder: OrderRow = {
    id: "ord-1",
    savedCompositionId: "comp-1",
    farmId: "farm-1",
    producerUserId: "prod-1",
    millProfileId: "mill-1",
    status: CompositionOrderStatus.SENT_TO_MILL,
    snapshotRation: [
      {
        feedIngredientId: "corn",
        canonicalName: "Maïs",
        quantityKg: 70,
        proportionPct: 70,
        costContribution: 14000
      }
    ],
    quotedPriceXof: 27000,
    finalPriceXof: null,
    millNote: null,
    productionStartEstimate: null,
    readyEstimate: null,
    productionStartedAt: null,
    readyActual: null,
    escrowTransactionRef: null,
    deadlineAt: new Date("2026-08-02T00:00:00Z"),
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z")
  };

  function build(order: OrderRow = baseOrder) {
    let current: OrderRow = { ...order };
    const prisma = {
      compositionOrder: {
        findUnique: jest.fn().mockImplementation(async () => ({ ...current })),
        create: jest.fn(),
        update: jest.fn().mockImplementation(async ({ data }) => {
          current = { ...current, ...data };
          return { ...current };
        }),
        updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
          if (where.status && where.status !== current.status) {
            return { count: 0 };
          }
          current = { ...current, ...data };
          return { count: 1 };
        })
      },
      compositionOrderTransition: {
        create: jest.fn().mockResolvedValue({})
      },
      savedComposition: {
        findUnique: jest.fn().mockResolvedValue({
          id: "comp-1",
          farmId: "farm-1",
          status: "validated",
          stage: "finishing",
          ration: baseOrder.snapshotRation,
          inputParams: {
            animalCount: 10,
            avgWeightKg: 80,
            durationDays: 30
          },
          millProfileId: "mill-1",
          farm: {
            id: "farm-1",
            name: "Ferme Test",
            latitude: 5.3,
            longitude: -4,
            departmentCode: "CI-AB",
            locationCity: "Abidjan",
            address: null
          }
        })
      },
      merchantProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: "mill-1",
          userId: "mill-user",
          merchantKind: "mill"
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: "mill-1",
          userId: "mill-user"
        })
      },
      feedIngredient: { findUnique: jest.fn() }
    };

    const farmAccess = {
      requireFarmScopes: jest.fn().mockResolvedValue(undefined)
    };
    const pricing = {
      priceForMills: jest.fn().mockResolvedValue({
        compositionId: "comp-1",
        farmId: "farm-1",
        radiusKm: 50,
        mills: [
          {
            millId: "mill-1",
            millName: "Moulin Bon",
            distanceKm: 3,
            totalPriceXof: 27000,
            missingIngredients: [],
            availabilityComplete: true,
            mixingCost: 1000
          }
        ]
      })
    };
    const formulation = {
      recomputeWithSubstitution: jest.fn().mockResolvedValue({
        feasible: true,
        ration: [
          {
            feedIngredientId: "soy",
            canonicalName: "Soja",
            quantityKg: 100,
            proportionPct: 100,
            costContribution: 40000
          }
        ],
        totalFeedKg: 100,
        dailyIntakeKg: 1,
        totalCostXof: 40000,
        costPerKg: 400,
        nutritionResult: {
          crudeProteinPct: 18,
          metabolizableEnergyKcal: 3300,
          lysinePct: 1,
          methioninePct: 0.3,
          calciumPct: 0.8,
          phosphorusPct: 0.6,
          crudeFiberPct: 4
        },
        deviations: [],
        warnings: [],
        infeasibilityReasons: [],
        nutritionDelta: {
          crudeProteinPct: 1,
          metabolizableEnergyKcal: 200,
          lysinePct: 0,
          methioninePct: 0,
          calciumPct: 0,
          phosphorusPct: 0,
          crudeFiberPct: 0,
          energyChangePct: 6.5
        },
        baseFeasible: true
      })
    };
    const availability = {
      resolve: jest.fn().mockResolvedValue({
        availableIngredients: [
          { feedIngredientId: "corn", pricePerKg: 200, maxAvailableKg: 500 },
          { feedIngredientId: "soy", pricePerKg: 400, maxAvailableKg: 500 }
        ],
        isTheoretical: false,
        millProfileId: "mill-1"
      })
    };
    const profiles = {
      getActiveByStage: jest.fn().mockResolvedValue({
        maxMetabolizableEnergyKcal: 3200
      })
    };
    const notifications = {
      notify: jest.fn().mockResolvedValue(undefined)
    };
    const escrow = {
      holdCompositionFunds: jest.fn().mockResolvedValue({
        providerRef: "wallet:composition-pending:ord-1",
        paymentMethod: "wallet",
        paymentUrl: null
      }),
      confirmCompositionHold: jest.fn().mockResolvedValue({
        success: true,
        providerRef: "wallet:entry-1"
      })
    };
    const gateway = {
      initiatePayment: jest.fn(),
      confirmPayment: jest.fn()
    };

    const service = new CompositionOrdersService(
      prisma as never,
      farmAccess as never,
      pricing as never,
      formulation as never,
      availability as never,
      profiles as never,
      notifications as never,
      escrow as never,
      gateway as never
    );

    return {
      service,
      prisma,
      formulation,
      notifications,
      setOrder: (next: OrderRow) => {
        current = { ...next };
      },
      getOrder: () => current
    };
  }

  function futureDates() {
    const start = new Date(Date.now() + 2 * 86400_000);
    const ready = new Date(Date.now() + 4 * 86400_000);
    return {
      productionStartEstimate: start.toISOString(),
      readyEstimate: ready.toISOString()
    };
  }

  it("sendToMill fige snapshot + quotedPrice + deadline + notifie le moulin", async () => {
    const { service, prisma, notifications } = build();
    prisma.compositionOrder.create.mockResolvedValue({
      ...baseOrder,
      status: CompositionOrderStatus.SENT_TO_MILL
    });
    const dto = await service.sendToMill(producer, "comp-1", {
      millProfileId: "mill-1"
    });
    expect(dto.quotedPriceXof).toBe(27000);
    expect(dto.status).toBe(CompositionOrderStatus.SENT_TO_MILL);
    expect(notifications.notify).toHaveBeenCalledWith(
      "mill-user",
      expect.any(String),
      expect.stringMatching(/27000/),
      expect.objectContaining({ type: "composition_order_sent" })
    );
  });

  it("MILL_REVISED exige les deux dates (rejet si manquantes)", async () => {
    const { service } = build();
    await expect(
      service.reviseAsMill(millUser, "ord-1", {
        productionStartEstimate: futureDates().productionStartEstimate,
        readyEstimate: undefined as unknown as string
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("MILL_REVISED refuse ready < productionStart", async () => {
    const { service } = build();
    const start = new Date(Date.now() + 4 * 86400_000).toISOString();
    const ready = new Date(Date.now() + 2 * 86400_000).toISOString();
    await expect(
      service.reviseAsMill(millUser, "ord-1", {
        productionStartEstimate: start,
        readyEstimate: ready
      })
    ).rejects.toThrow(/disponibilité/);
  });

  it("substitution passe par recomputeWithSubstitution + alerte gras", async () => {
    const { service, formulation, notifications, getOrder } = build();
    const dates = futureDates();
    const res = await service.reviseAsMill(millUser, "ord-1", {
      ...dates,
      removeIngredientId: "corn",
      addIngredientId: "soy"
    });
    expect(formulation.recomputeWithSubstitution).toHaveBeenCalled();
    expect(res.fatRiskAlert).toBe(true);
    expect(getOrder().status).toBe(CompositionOrderStatus.MILL_REVISED);
    expect(getOrder().finalPriceXof).toBe(40000);
    expect(notifications.notify).toHaveBeenCalledWith(
      "prod-1",
      expect.any(String),
      expect.stringMatching(/Production possible/),
      expect.objectContaining({ type: "composition_order_revised" })
    );
  });

  it("snapshot figé : révision n’utilise pas la ration live modifiée après coup", async () => {
    const { service, prisma, formulation } = build();
    // ration live différente du snapshot
    prisma.savedComposition.findUnique.mockResolvedValue({
      id: "comp-1",
      farmId: "farm-1",
      status: "validated",
      stage: "finishing",
      ration: [{ feedIngredientId: "CHANGED", quantityKg: 1 }],
      inputParams: {
        animalCount: 10,
        avgWeightKg: 80,
        durationDays: 30
      },
      millProfileId: "mill-1"
    });
    await service.reviseAsMill(millUser, "ord-1", {
      ...futureDates(),
      removeIngredientId: "corn",
      addIngredientId: "soy"
    });
    // Le moteur est appelé avec le stage/params ; la ration de travail reste le snapshot côté update
    expect(formulation.recomputeWithSubstitution).toHaveBeenCalled();
    const updateData = prisma.compositionOrder.updateMany.mock.calls[0][0]
      .data as {
      snapshotRation: Array<{ feedIngredientId: string }>;
    };
    expect(updateData.snapshotRation[0].feedIngredientId).toBe("soy");
  });

  it("accept fige prix + dates ; cancel avant paiement sans remboursement", async () => {
    const { service, setOrder, getOrder } = build();
    const dates = futureDates();
    setOrder({
      ...baseOrder,
      status: CompositionOrderStatus.MILL_REVISED,
      finalPriceXof: 27000,
      productionStartEstimate: new Date(dates.productionStartEstimate),
      readyEstimate: new Date(dates.readyEstimate)
    });
    await service.accept(producer, "ord-1");
    expect(getOrder().status).toBe(CompositionOrderStatus.ACCEPTED);

    setOrder({
      ...getOrder(),
      status: CompositionOrderStatus.ACCEPTED
    });
    await service.cancel(producer, "ord-1");
    expect(getOrder().status).toBe(CompositionOrderStatus.CANCELLED);
  });

  it("paiement escrow : montant = finalPriceXof + notifie les deux parties", async () => {
    const { service, setOrder, notifications, prisma, getOrder } = build();
    setOrder({
      ...baseOrder,
      status: CompositionOrderStatus.ACCEPTED,
      finalPriceXof: 30500,
      productionStartEstimate: new Date(),
      readyEstimate: new Date(),
      escrowTransactionRef: "wallet:composition-pending:ord-1"
    });
    // expose escrow mock via re-build internals — confirm via finalize
    const escrow = {
      holdCompositionFunds: jest.fn().mockResolvedValue({
        providerRef: "wallet:composition-pending:ord-1",
        paymentMethod: "wallet",
        paymentUrl: null
      }),
      confirmCompositionHold: jest.fn().mockResolvedValue({
        success: true,
        providerRef: "wallet:entry-1"
      })
    };
    (service as unknown as { escrow: typeof escrow }).escrow = escrow;

    const init = await service.initiatePayment(producer, "ord-1", {
      paymentMethod: "wallet" as never
    });
    expect(init.amount).toBe(30500);
    expect(escrow.holdCompositionFunds).toHaveBeenCalledWith(
      "ord-1",
      "prod-1",
      30500,
      "XOF",
      expect.any(String),
      { paymentMethod: "wallet" }
    );
    expect(prisma.compositionOrder.update).toHaveBeenCalled();

    setOrder({
      ...getOrder(),
      status: CompositionOrderStatus.ACCEPTED,
      finalPriceXof: 30500,
      escrowTransactionRef: init.providerRef
    });
    await service.confirmPayment(producer, "ord-1", {});
    expect(getOrder().status).toBe(CompositionOrderStatus.PAID);
    expect(notifications.notify).toHaveBeenCalledWith(
      "prod-1",
      expect.stringMatching(/sécurisé/i),
      expect.any(String),
      expect.objectContaining({ type: "composition_order_paid" })
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      "mill-user",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ type: "composition_order_paid_mill" })
    );
  });

  it("readyActual distinct de readyEstimate à MARK_READY", async () => {
    const estimate = new Date("2026-08-14T00:00:00Z");
    const { service, setOrder, getOrder } = build();
    setOrder({
      ...baseOrder,
      status: CompositionOrderStatus.IN_PRODUCTION,
      readyEstimate: estimate,
      productionStartEstimate: new Date("2026-08-12T00:00:00Z"),
      finalPriceXof: 27000
    });
    const before = Date.now();
    await service.markReady(millUser, "ord-1");
    const order = getOrder();
    expect(order.status).toBe(CompositionOrderStatus.READY_FOR_PICKUP);
    expect(order.readyActual).toBeInstanceOf(Date);
    expect(order.readyActual!.getTime()).toBeGreaterThanOrEqual(before);
    expect(order.readyEstimate!.toISOString()).toBe(estimate.toISOString());
    expect(order.readyActual!.toISOString()).not.toBe(estimate.toISOString());
  });

  it("non-retour : cancel interdit après IN_PRODUCTION", async () => {
    const { service, setOrder } = build();
    setOrder({
      ...baseOrder,
      status: CompositionOrderStatus.IN_PRODUCTION,
      finalPriceXof: 27000
    });
    await expect(service.cancel(producer, "ord-1")).rejects.toThrow(
      /Transition interdite/
    );
  });
});
