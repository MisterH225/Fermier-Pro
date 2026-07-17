import { ConflictException, ForbiddenException } from "@nestjs/common";
import { MerchantProductStatus } from "@prisma/client";
import { MERCHANT_ERROR } from "./merchant-shop.constants";
import { MerchantModerationService } from "./merchant-moderation.service";
import { MerchantProductsService } from "./merchant-products.service";

describe("Merchant product resubmission", () => {
  const user = { id: "seller-1" } as never;
  const admin = { id: "admin-1" } as never;

  function productBase(overrides: Record<string, unknown> = {}) {
    return {
      id: "prod-1",
      shopId: "shop-1",
      categoryId: "cat-1",
      name: "Aliment",
      description: null,
      price: 1000,
      currency: "XOF",
      photoUrls: [],
      stock: 5,
      viewCount: 0,
      status: MerchantProductStatus.moderated_removed,
      publishedAt: null,
      disabledAt: new Date(),
      disabledReason: "moderation",
      moderationReason: "Mauvaise photo",
      moderatedAt: new Date(),
      resubmissionCount: 0,
      resubmittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: { id: "cat-1", name: "Cat", slug: "cat" },
      shop: { id: "shop-1", name: "Boutique" },
      ...overrides
    };
  }

  describe("MerchantProductsService.resubmit / publish", () => {
    it("autorise la re-soumission depuis moderated_removed", async () => {
      const base = productBase();
      const updated = productBase({
        status: MerchantProductStatus.resubmission_review,
        resubmissionCount: 1,
        resubmittedAt: new Date()
      });
      const prisma = {
        merchantProduct: {
          findFirst: jest.fn().mockResolvedValue(base),
          update: jest.fn().mockResolvedValue(updated)
        }
      };
      const service = new MerchantProductsService(prisma as never, {} as never);

      const result = await service.resubmit(user, "prod-1");

      expect(result.status).toBe(MerchantProductStatus.resubmission_review);
      expect(result.resubmissionCount).toBe(1);
      expect(prisma.merchantProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MerchantProductStatus.resubmission_review,
            resubmissionCount: { increment: 1 }
          })
        })
      );
    });

    it("refuse au-delà de 2 re-soumissions (403 contactez le support)", async () => {
      const prisma = {
        merchantProduct: {
          findFirst: jest
            .fn()
            .mockResolvedValue(productBase({ resubmissionCount: 2 }))
        }
      };
      const service = new MerchantProductsService(prisma as never, {} as never);

      await expect(service.resubmit(user, "prod-1")).rejects.toBeInstanceOf(
        ForbiddenException
      );
      try {
        await service.resubmit(user, "prod-1");
      } catch (e) {
        expect((e as ForbiddenException).getResponse()).toMatchObject({
          code: MERCHANT_ERROR.RESUBMISSION_LIMIT
        });
      }
    });

    it("publish reste bloqué sur moderated_removed et resubmission_review", async () => {
      const profiles = {
        assertSubscriptionChosen: jest.fn().mockResolvedValue("premium")
      };

      for (const status of [
        MerchantProductStatus.moderated_removed,
        MerchantProductStatus.resubmission_review
      ]) {
        const prisma = {
          merchantProduct: {
            findFirst: jest.fn().mockResolvedValue(productBase({ status }))
          }
        };
        const service = new MerchantProductsService(
          prisma as never,
          profiles as never
        );
        await expect(service.publish(user, "prod-1")).rejects.toBeInstanceOf(
          ConflictException
        );
      }
    });

    it("le catalogue public n’inclut pas resubmission_review", async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { merchantProduct: { findMany } };
      const service = new MerchantProductsService(prisma as never, {} as never);

      await service.listCatalog();

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: MerchantProductStatus.published
          })
        })
      );
    });
  });

  describe("MerchantModerationService approve / reject", () => {
    it("approve → published si stock > 0", async () => {
      const product = {
        ...productBase({
          status: MerchantProductStatus.resubmission_review,
          stock: 3,
          resubmissionCount: 1
        }),
        shop: { merchantProfile: { userId: "seller-1" } }
      };
      const prisma = {
        merchantProduct: {
          findUnique: jest.fn().mockResolvedValue(product),
          update: jest.fn().mockResolvedValue({
            id: "prod-1",
            status: MerchantProductStatus.published
          })
        }
      };
      const push = { sendToUser: jest.fn() };
      const audit = { record: jest.fn() };
      const service = new MerchantModerationService(
        prisma as never,
        push as never,
        {} as never,
        audit as never
      );

      const result = await service.approveResubmission(admin, "prod-1");

      expect(result).toEqual({
        ok: true,
        id: "prod-1",
        status: MerchantProductStatus.published
      });
      expect(prisma.merchantProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MerchantProductStatus.published,
            moderationReason: null
          })
        })
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "merchant_product.approve_resubmission"
        })
      );
      expect(push.sendToUser).toHaveBeenCalledWith(
        "seller-1",
        "Produit revalidé",
        expect.stringContaining("revalidé"),
        expect.any(Object)
      );
    });

    it("approve → draft si stock à 0", async () => {
      const product = {
        ...productBase({
          status: MerchantProductStatus.resubmission_review,
          stock: 0
        }),
        shop: { merchantProfile: { userId: "seller-1" } }
      };
      const prisma = {
        merchantProduct: {
          findUnique: jest.fn().mockResolvedValue(product),
          update: jest.fn().mockResolvedValue({
            id: "prod-1",
            status: MerchantProductStatus.draft
          })
        }
      };
      const service = new MerchantModerationService(
        prisma as never,
        { sendToUser: jest.fn() } as never,
        {} as never,
        { record: jest.fn() } as never
      );

      const result = await service.approveResubmission(admin, "prod-1");
      expect(result.status).toBe(MerchantProductStatus.draft);
    });

    it("reject → moderated_removed avec nouveau motif", async () => {
      const product = {
        ...productBase({
          status: MerchantProductStatus.resubmission_review,
          resubmissionCount: 1
        }),
        shop: { merchantProfile: { userId: "seller-1" } }
      };
      const prisma = {
        merchantProduct: {
          findUnique: jest.fn().mockResolvedValue(product),
          update: jest.fn().mockResolvedValue({})
        },
        merchantProductModerationLog: {
          create: jest.fn().mockResolvedValue({})
        },
        $transaction: jest.fn(async (ops: unknown[]) => ops)
      };
      const push = { sendToUser: jest.fn() };
      const audit = { record: jest.fn() };
      const service = new MerchantModerationService(
        prisma as never,
        push as never,
        {} as never,
        audit as never
      );

      const result = await service.rejectResubmission(admin, "prod-1", {
        reason: "Toujours incorrect"
      });

      expect(result).toEqual({ ok: true, id: "prod-1" });
      expect(prisma.merchantProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MerchantProductStatus.moderated_removed,
            moderationReason: "Toujours incorrect"
          })
        })
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "merchant_product.reject_resubmission"
        })
      );
    });

    it("deleteProduct persiste moderationReason / moderatedAt", async () => {
      const product = {
        id: "prod-1",
        name: "Aliment",
        description: null,
        price: 1000,
        stock: 2,
        status: MerchantProductStatus.published,
        photoUrls: [],
        shop: { merchantProfile: { userId: "seller-1" } }
      };
      const update = jest.fn().mockResolvedValue({});
      const createLog = jest.fn().mockResolvedValue({});
      const prisma = {
        merchantProduct: {
          findUnique: jest.fn().mockResolvedValue(product),
          update
        },
        merchantProductModerationLog: { create: createLog },
        $transaction: jest.fn(async (ops: unknown[]) => ops)
      };
      const service = new MerchantModerationService(
        prisma as never,
        { sendToUser: jest.fn() } as never,
        {} as never,
        { record: jest.fn() } as never
      );

      await service.deleteProduct(admin, "prod-1", {
        reason: "Photo floue"
      });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MerchantProductStatus.moderated_removed,
            moderationReason: "Photo floue",
            moderatedAt: expect.any(Date)
          })
        })
      );
      expect(createLog).toHaveBeenCalled();
    });
  });
});
