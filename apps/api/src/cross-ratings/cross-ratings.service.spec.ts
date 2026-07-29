import {
  BadRequestException,
  ForbiddenException
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  MarketplaceTransactionStatus,
  MerchantOrderStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RATING_EDIT_WINDOW_DAYS } from "../trust-score/trust-score.constants";
import { CrossRatingsService } from "./cross-ratings.service";

describe("CrossRatingsService", () => {
  let service: CrossRatingsService;
  let prisma: {
    marketplaceTransaction: { findUnique: jest.Mock };
    merchantOrder: { findUnique: jest.Mock };
    buyerRating: {
      create: jest.Mock;
      update: jest.Mock;
      aggregate: jest.Mock;
      findUnique: jest.Mock;
    };
    merchantRating: {
      create: jest.Mock;
      update: jest.Mock;
      aggregate: jest.Mock;
    };
    technicianRating: {
      create: jest.Mock;
      findUnique: jest.Mock;
      aggregate: jest.Mock;
    };
    buyerProfile: { updateMany: jest.Mock };
    farm: { findUnique: jest.Mock };
    farmMembership: { findFirst: jest.Mock };
  };

  const seller = { id: "seller-1" } as never;
  const buyer = { id: "buyer-1" } as never;
  const owner = { id: "owner-1" } as never;

  beforeEach(async () => {
    prisma = {
      marketplaceTransaction: { findUnique: jest.fn() },
      merchantOrder: { findUnique: jest.fn() },
      buyerRating: {
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({
          _avg: { score: 5 },
          _count: 1
        }),
        findUnique: jest.fn()
      },
      merchantRating: {
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn()
      },
      technicianRating: {
        create: jest.fn(),
        findUnique: jest.fn(),
        aggregate: jest.fn()
      },
      buyerProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      farm: { findUnique: jest.fn() },
      farmMembership: { findFirst: jest.fn() }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrossRatingsService,
        { provide: PrismaService, useValue: prisma }
      ]
    }).compile();

    service = module.get(CrossRatingsService);
  });

  it("closed marketplace tx → seller can rate buyer once", async () => {
    prisma.marketplaceTransaction.findUnique.mockResolvedValue({
      id: "tx-1",
      status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
      sellerUserId: "seller-1",
      buyerUserId: "buyer-1",
      buyerRating: null
    });
    prisma.buyerRating.create.mockResolvedValue({
      id: "br-1",
      score: 5,
      buyerUserId: "buyer-1",
      ratedByUserId: "seller-1"
    });

    const result = await service.createBuyerRating(seller, {
      marketplaceTransactionId: "tx-1",
      score: 5
    });

    expect(result.id).toBe("br-1");
    expect(prisma.buyerRating.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        buyerUserId: "buyer-1",
        ratedByUserId: "seller-1",
        marketplaceTransactionId: "tx-1",
        score: 5
      })
    });
    expect(prisma.buyerProfile.updateMany).toHaveBeenCalled();
  });

  it("second rating same tx refused after edit window", async () => {
    const old = new Date();
    old.setUTCDate(old.getUTCDate() - (RATING_EDIT_WINDOW_DAYS + 1));
    prisma.marketplaceTransaction.findUnique.mockResolvedValue({
      id: "tx-1",
      status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
      sellerUserId: "seller-1",
      buyerUserId: "buyer-1",
      buyerRating: {
        id: "br-1",
        createdAt: old,
        ratedByUserId: "seller-1"
      }
    });

    await expect(
      service.createBuyerRating(seller, {
        marketplaceTransactionId: "tx-1",
        score: 3
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.buyerRating.create).not.toHaveBeenCalled();
    expect(prisma.buyerRating.update).not.toHaveBeenCalled();
  });

  it("cancelled tx → cannot rate", async () => {
    prisma.marketplaceTransaction.findUnique.mockResolvedValue({
      id: "tx-2",
      status: MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
      sellerUserId: "seller-1",
      buyerUserId: "buyer-1",
      buyerRating: null
    });

    await expect(
      service.createBuyerRating(seller, {
        marketplaceTransactionId: "tx-2",
        score: 4
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("technician second rating same month refused", async () => {
    prisma.farm.findUnique.mockResolvedValue({
      id: "farm-1",
      ownerId: "owner-1"
    });
    prisma.farmMembership.findFirst.mockResolvedValue({
      id: "mem-1",
      farmId: "farm-1",
      userId: "tech-1"
    });
    prisma.technicianRating.findUnique.mockResolvedValue({
      id: "tr-1",
      createdAt: new Date(),
      score: 4
    });

    await expect(
      service.createTechnicianRating(owner, {
        technicianUserId: "tech-1",
        farmId: "farm-1",
        score: 5
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.technicianRating.create).not.toHaveBeenCalled();
  });

  it("update within 7 days allowed; after 7 days refused", async () => {
    const recent = new Date();
    recent.setUTCDate(recent.getUTCDate() - 2);
    prisma.marketplaceTransaction.findUnique.mockResolvedValue({
      id: "tx-3",
      status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
      sellerUserId: "seller-1",
      buyerUserId: "buyer-1",
      buyerRating: {
        id: "br-2",
        createdAt: recent,
        ratedByUserId: "seller-1"
      }
    });
    prisma.buyerRating.update.mockResolvedValue({
      id: "br-2",
      score: 2
    });

    const updated = await service.createBuyerRating(seller, {
      marketplaceTransactionId: "tx-3",
      score: 2,
      comment: "ok"
    });
    expect(updated.score).toBe(2);
    expect(prisma.buyerRating.update).toHaveBeenCalled();

    const stale = new Date();
    stale.setUTCDate(stale.getUTCDate() - (RATING_EDIT_WINDOW_DAYS + 3));
    prisma.marketplaceTransaction.findUnique.mockResolvedValue({
      id: "tx-3",
      status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
      sellerUserId: "seller-1",
      buyerUserId: "buyer-1",
      buyerRating: {
        id: "br-2",
        createdAt: stale,
        ratedByUserId: "seller-1"
      }
    });

    await expect(
      service.createBuyerRating(seller, {
        marketplaceTransactionId: "tx-3",
        score: 1
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("non-seller cannot rate buyer", async () => {
    prisma.marketplaceTransaction.findUnique.mockResolvedValue({
      id: "tx-4",
      status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
      sellerUserId: "seller-1",
      buyerUserId: "buyer-1",
      buyerRating: null
    });

    await expect(
      service.createBuyerRating(buyer, {
        marketplaceTransactionId: "tx-4",
        score: 5
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("merchant order must be completed to rate buyer", async () => {
    prisma.merchantOrder.findUnique.mockResolvedValue({
      id: "mo-1",
      status: MerchantOrderStatus.cancelled,
      sellerUserId: "seller-1",
      buyerUserId: "buyer-1",
      buyerRating: null
    });

    await expect(
      service.createBuyerRating(seller, {
        merchantOrderId: "mo-1",
        score: 4
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
