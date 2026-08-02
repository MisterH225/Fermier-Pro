import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  CompositionFulfillmentMode,
  CompositionOrderDisputeStatus,
  CompositionOrderStatus,
  DeliveryStatus
} from "@prisma/client";
import { COMPOSITION_ORDER_DISPUTE_WINDOW_MS } from "./composition-orders.constants";
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
    fulfillmentMode: CompositionFulfillmentMode;
    confirmedReceivedAt: Date | null;
    disputeWindowEndsAt: Date | null;
    escrowReleasedAt: Date | null;
    completedAt: Date | null;
    disputeOpenedAt: Date | null;
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
    fulfillmentMode: CompositionFulfillmentMode.PICKUP,
    confirmedReceivedAt: null,
    disputeWindowEndsAt: null,
    escrowReleasedAt: null,
    completedAt: null,
    disputeOpenedAt: null,
    escrowTransactionRef: null,
    deadlineAt: new Date("2026-08-02T00:00:00Z"),
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z")
  };

  function build(order: OrderRow = baseOrder) {
    let current: OrderRow = { ...order };
    let deliveryRow: {
      id: string;
      compositionOrderId: string;
      status: DeliveryStatus;
      feeXof: number;
      note: string | null;
      scheduledAt: Date | null;
      deliveredAt: Date | null;
    } | null = null;
    let disputeRow: {
      id: string;
      orderId: string;
      openedByUserId: string;
      reason: string;
      status: CompositionOrderDisputeStatus;
      resolvedAt: Date | null;
      resolvedByUserId: string | null;
      resolutionNote: string | null;
      createdAt: Date;
    } | null = null;

    const prisma = {
      compositionOrder: {
        findUnique: jest.fn().mockImplementation(async (args?: {
          include?: { delivery?: boolean; dispute?: boolean };
        }) => {
          const row: Record<string, unknown> = { ...current };
          if (args?.include?.delivery) row.delivery = deliveryRow;
          if (args?.include?.dispute) row.dispute = disputeRow;
          return row;
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(async (args?: {
          include?: { delivery?: boolean; dispute?: boolean };
        }) => {
          const row: Record<string, unknown> = { ...current };
          if (args?.include?.delivery) row.delivery = deliveryRow;
          if (args?.include?.dispute) row.dispute = disputeRow;
          return row;
        }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn().mockImplementation(async ({ data }) => {
          current = { ...current, ...data };
          return { ...current };
        }),
        updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
          if (where.status && where.status !== current.status) {
            return { count: 0 };
          }
          if (
            where.escrowReleasedAt === null &&
            current.escrowReleasedAt != null
          ) {
            return { count: 0 };
          }
          current = { ...current, ...data };
          return { count: 1 };
        })
      },
      compositionOrderTransition: {
        create: jest.fn().mockResolvedValue({})
      },
      compositionOrderDispute: {
        findUnique: jest.fn().mockImplementation(async () => disputeRow),
        create: jest.fn().mockImplementation(async ({ data }) => {
          disputeRow = {
            id: "disp-1",
            orderId: data.orderId,
            openedByUserId: data.openedByUserId,
            reason: data.reason,
            status: CompositionOrderDisputeStatus.open,
            resolvedAt: null,
            resolvedByUserId: null,
            resolutionNote: null,
            createdAt: new Date()
          };
          return disputeRow;
        }),
        update: jest.fn().mockImplementation(async ({ data }) => {
          disputeRow = { ...disputeRow!, ...data };
          return disputeRow;
        })
      },
      delivery: {
        findUnique: jest.fn().mockImplementation(async () => deliveryRow),
        create: jest.fn().mockImplementation(async ({ data }) => {
          deliveryRow = {
            id: "del-1",
            compositionOrderId: data.compositionOrderId,
            status: data.status,
            feeXof: Number(data.feeXof),
            note: data.note ?? null,
            scheduledAt: data.scheduledAt ?? null,
            deliveredAt: data.deliveredAt ?? null
          };
          return deliveryRow;
        }),
        update: jest.fn().mockImplementation(async ({ data }) => {
          deliveryRow = { ...deliveryRow!, ...data };
          return deliveryRow;
        })
      },
      $transaction: jest.fn().mockImplementation(async (arg) => {
        if (typeof arg === "function") {
          return arg(prisma);
        }
        return Promise.all(arg);
      }),
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
      }),
      releaseCompositionFundsToMill: jest.fn().mockResolvedValue(undefined),
      refundCompositionBuyer: jest.fn().mockResolvedValue(undefined)
    };
    const gateway = {
      initiatePayment: jest.fn(),
      confirmPayment: jest.fn()
    };
    const platformFlags = {
      isModuleActiveForUser: jest.fn().mockResolvedValue(true),
      getInactiveMessage: jest.fn().mockResolvedValue(null)
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
      gateway as never,
      platformFlags as never
    );

    return {
      service,
      prisma,
      formulation,
      notifications,
      escrow,
      platformFlags,
      setOrder: (next: OrderRow) => {
        current = { ...next };
      },
      getOrder: () => current,
      setDelivery: (
        next: typeof deliveryRow
      ) => {
        deliveryRow = next;
      },
      getDelivery: () => deliveryRow,
      getDispute: () => disputeRow
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

  it("readyActual distinct de readyEstimate à MARK_READY + arme fenêtre litige", async () => {
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
    expect(order.fulfillmentMode).toBe(CompositionFulfillmentMode.PICKUP);
    expect(order.readyActual).toBeInstanceOf(Date);
    expect(order.readyActual!.getTime()).toBeGreaterThanOrEqual(before);
    expect(order.readyEstimate!.toISOString()).toBe(estimate.toISOString());
    expect(order.readyActual!.toISOString()).not.toBe(estimate.toISOString());
    expect(order.disputeWindowEndsAt).toBeInstanceOf(Date);
    expect(
      order.disputeWindowEndsAt!.getTime() - order.readyActual!.getTime()
    ).toBe(COMPOSITION_ORDER_DISPUTE_WINDOW_MS);
    // Fenêtre armée sur readyActual, PAS readyEstimate
    expect(
      order.disputeWindowEndsAt!.getTime() - estimate.getTime()
    ).not.toBe(COMPOSITION_ORDER_DISPUTE_WINDOW_MS);
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

  it("retrait → confirmation → libération via releaseCompositionFundsToMill", async () => {
    const readyActual = new Date();
    const { service, setOrder, getOrder, escrow, notifications } = build();
    setOrder({
      ...baseOrder,
      status: CompositionOrderStatus.READY_FOR_PICKUP,
      finalPriceXof: 30500,
      readyActual,
      disputeWindowEndsAt: new Date(
        readyActual.getTime() + COMPOSITION_ORDER_DISPUTE_WINDOW_MS
      ),
      fulfillmentMode: CompositionFulfillmentMode.PICKUP
    });
    await service.confirmReceipt(producer, "ord-1");
    expect(escrow.releaseCompositionFundsToMill).toHaveBeenCalledWith(
      "ord-1",
      "mill-user",
      30500,
      "XOF"
    );
    expect(getOrder().status).toBe(CompositionOrderStatus.COMPLETED);
    expect(getOrder().escrowReleasedAt).toBeInstanceOf(Date);
    expect(getOrder().confirmedReceivedAt).toBeInstanceOf(Date);
    expect(notifications.notify).toHaveBeenCalledWith(
      "mill-user",
      expect.stringMatching(/versé/i),
      expect.any(String),
      expect.objectContaining({ type: "composition_order_completed_mill" })
    );
  });

  it("livraison → deliveredAt arme la fenêtre (pas readyEstimate) puis confirmation", async () => {
    const estimate = new Date("2026-08-12T00:00:00Z");
    const { service, setOrder, getOrder, setDelivery, escrow, platformFlags } =
      build();
    setOrder({
      ...baseOrder,
      status: CompositionOrderStatus.IN_PRODUCTION,
      finalPriceXof: 27000,
      readyEstimate: estimate
    });
    await service.markOutForDelivery(millUser, "ord-1", { feeXof: 1500 });
    expect(platformFlags.isModuleActiveForUser).toHaveBeenCalledWith(
      "delivery",
      "mill-user"
    );
    expect(getOrder().status).toBe(CompositionOrderStatus.OUT_FOR_DELIVERY);
    expect(getOrder().disputeWindowEndsAt).toBeNull();

    setDelivery({
      id: "del-1",
      compositionOrderId: "ord-1",
      status: DeliveryStatus.out,
      feeXof: 1500,
      note: null,
      scheduledAt: new Date(),
      deliveredAt: null
    });
    const before = Date.now();
    await service.markDelivered(millUser, "ord-1");
    const windowEnd = getOrder().disputeWindowEndsAt!;
    expect(windowEnd.getTime()).toBeGreaterThanOrEqual(
      before + COMPOSITION_ORDER_DISPUTE_WINDOW_MS - 50
    );
    // PAS armé sur readyEstimate
    expect(windowEnd.getTime() - estimate.getTime()).not.toBe(
      COMPOSITION_ORDER_DISPUTE_WINDOW_MS
    );

    setOrder({
      ...getOrder(),
      status: CompositionOrderStatus.OUT_FOR_DELIVERY
    });
    setDelivery({
      id: "del-1",
      compositionOrderId: "ord-1",
      status: DeliveryStatus.delivered,
      feeXof: 1500,
      note: null,
      scheduledAt: new Date(),
      deliveredAt: new Date()
    });
    await service.confirmReceipt(producer, "ord-1");
    expect(escrow.releaseCompositionFundsToMill).toHaveBeenCalled();
    expect(getOrder().status).toBe(CompositionOrderStatus.COMPLETED);
  });

  it("litige pendant la fenêtre suspend la libération ; résolution moulin libère", async () => {
    const readyActual = new Date();
    const { service, setOrder, getOrder, escrow } = build();
    setOrder({
      ...baseOrder,
      status: CompositionOrderStatus.READY_FOR_PICKUP,
      finalPriceXof: 27000,
      readyActual,
      disputeWindowEndsAt: new Date(
        readyActual.getTime() + COMPOSITION_ORDER_DISPUTE_WINDOW_MS
      )
    });
    await service.openDispute(producer, "ord-1", {
      reason: "Sac manquant"
    });
    expect(getOrder().status).toBe(CompositionOrderStatus.DISPUTED);
    expect(escrow.releaseCompositionFundsToMill).not.toHaveBeenCalled();

    // Cron ne libère pas les commandes disputées
    const released = await service.runTrackingCycle(
      new Date(readyActual.getTime() + COMPOSITION_ORDER_DISPUTE_WINDOW_MS + 1)
    );
    expect(released).toBe(0);

    await service.resolveDispute("admin-1", "ord-1", "mill", "OK moulin");
    expect(escrow.releaseCompositionFundsToMill).toHaveBeenCalledWith(
      "ord-1",
      "mill-user",
      27000,
      "XOF"
    );
    expect(getOrder().status).toBe(CompositionOrderStatus.COMPLETED);
  });

  it("libération auto à fin de fenêtre sans réponse", async () => {
    const readyActual = new Date("2026-08-01T00:00:00Z");
    const windowEnd = new Date(
      readyActual.getTime() + COMPOSITION_ORDER_DISPUTE_WINDOW_MS
    );
    const { service, setOrder, prisma, escrow, getOrder } = build();
    const due = {
      ...baseOrder,
      status: CompositionOrderStatus.READY_FOR_PICKUP,
      finalPriceXof: 27000,
      readyActual,
      disputeWindowEndsAt: windowEnd,
      escrowReleasedAt: null
    };
    setOrder(due);
    prisma.compositionOrder.findMany.mockResolvedValue([due]);
    const n = await service.runTrackingCycle(
      new Date(windowEnd.getTime() + 1000)
    );
    expect(n).toBe(1);
    expect(escrow.releaseCompositionFundsToMill).toHaveBeenCalled();
    expect(getOrder().status).toBe(CompositionOrderStatus.COMPLETED);
  });

  it("pas de double libération (claim atomique)", async () => {
    const readyActual = new Date();
    const { service, setOrder, escrow } = build();
    setOrder({
      ...baseOrder,
      status: CompositionOrderStatus.READY_FOR_PICKUP,
      finalPriceXof: 27000,
      readyActual,
      disputeWindowEndsAt: new Date(
        readyActual.getTime() + COMPOSITION_ORDER_DISPUTE_WINDOW_MS
      ),
      escrowReleasedAt: new Date()
    });
    await expect(service.confirmReceipt(producer, "ord-1")).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(escrow.releaseCompositionFundsToMill).not.toHaveBeenCalled();
  });

  it("résolution litige producteur → refundCompositionBuyer", async () => {
    const readyActual = new Date();
    const { service, setOrder, escrow, getOrder } = build();
    setOrder({
      ...baseOrder,
      status: CompositionOrderStatus.READY_FOR_PICKUP,
      finalPriceXof: 27000,
      readyActual,
      disputeWindowEndsAt: new Date(
        readyActual.getTime() + COMPOSITION_ORDER_DISPUTE_WINDOW_MS
      )
    });
    await service.openDispute(producer, "ord-1", { reason: "Mauvais intrant" });
    expect(getOrder().status).toBe(CompositionOrderStatus.DISPUTED);

    await service.resolveDispute("admin-1", "ord-1", "producer", "défaut");
    expect(escrow.refundCompositionBuyer).toHaveBeenCalledWith(
      "ord-1",
      "prod-1",
      27000,
      "XOF"
    );
    expect(getOrder().status).toBe(CompositionOrderStatus.REFUNDED);
  });
});
