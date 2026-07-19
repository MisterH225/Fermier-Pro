import { Prisma } from "@prisma/client";
import { IdempotencyService } from "./idempotency.service";

describe("IdempotencyService", () => {
  const prisma = {
    idempotencyKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn()
    }
  };

  let service: IdempotencyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IdempotencyService(prisma as never);
  });

  it("findCompleted retourne null si la clé est absente", async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue(null);
    await expect(
      service.findCompleted("k1", "user-1")
    ).resolves.toBeNull();
  });

  it("findCompleted refuse une clé appartenant à un autre user", async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: "k1",
      userId: "other",
      statusCode: 201,
      responseBody: { id: "x" }
    });
    await expect(
      service.findCompleted("k1", "user-1")
    ).resolves.toBeNull();
  });

  it("findCompleted rejoue une réponse finalisée", async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: "k1",
      userId: "user-1",
      statusCode: 201,
      responseBody: { id: "weight-1" }
    });
    await expect(service.findCompleted("k1", "user-1")).resolves.toEqual({
      statusCode: 201,
      responseBody: { id: "weight-1" }
    });
  });

  it("claimOrExists réserve une nouvelle clé", async () => {
    prisma.idempotencyKey.create.mockResolvedValue({});
    await expect(
      service.claimOrExists("k1", "user-1", "POST", "/weights")
    ).resolves.toBe("claimed");
    expect(prisma.idempotencyKey.create).toHaveBeenCalled();
  });

  it("claimOrExists détecte une collision unique (dédup)", async () => {
    prisma.idempotencyKey.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique", {
        code: "P2002",
        clientVersion: "test"
      })
    );
    await expect(
      service.claimOrExists("k1", "user-1", "POST", "/weights")
    ).resolves.toBe("exists");
  });

  it("saveCompleted upsert la réponse pour rejeu ultérieur", async () => {
    prisma.idempotencyKey.upsert.mockResolvedValue({});
    await service.saveCompleted(
      "k1",
      "user-1",
      "POST",
      "/weights",
      201,
      { id: "w1" }
    );
    expect(prisma.idempotencyKey.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "k1" },
        create: expect.objectContaining({
          key: "k1",
          userId: "user-1",
          statusCode: 201,
          responseBody: { id: "w1" }
        })
      })
    );
  });

  it("saveCompleted sérialise Prisma.Decimal en string (JSON filaire)", async () => {
    prisma.idempotencyKey.upsert.mockResolvedValue({});
    await service.saveCompleted(
      "k1",
      "user-1",
      "POST",
      "/weights",
      201,
      { weightKg: new Prisma.Decimal("12.5"), amount: new Prisma.Decimal(100) }
    );
    expect(prisma.idempotencyKey.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          responseBody: { weightKg: "12.5", amount: "100" }
        })
      })
    );
  });
});
