import { Test, TestingModule } from "@nestjs/testing";
import { WalletFeeTransactionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WalletFeeService } from "./wallet-fee.service";

describe("WalletFeeService", () => {
  let service: WalletFeeService;
  const prisma = {
    walletFeeConfig: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletFeeService,
        { provide: PrismaService, useValue: prisma }
      ]
    }).compile();
    service = module.get(WalletFeeService);
  });

  it("returns zero fee when percentage is 0", async () => {
    prisma.walletFeeConfig.findUnique.mockResolvedValue({
      transactionType: WalletFeeTransactionType.transfer,
      feePercentage: 0,
      feeFixed: 0,
      minFee: 0,
      maxFee: null,
      isActive: true
    });
    prisma.walletFeeConfig.upsert.mockResolvedValue({});

    const result = await service.calculateFee(
      WalletFeeTransactionType.transfer,
      10_000
    );
    expect(result.feeAmount).toBe(0);
    expect(result.isFree).toBe(true);
    expect(result.totalDebit).toBe(10_000);
  });

  it("applies percentage with min and max caps", async () => {
    prisma.walletFeeConfig.findUnique.mockResolvedValue({
      transactionType: WalletFeeTransactionType.transfer,
      feePercentage: 0.01,
      feeFixed: 0,
      minFee: 100,
      maxFee: 2000,
      isActive: true
    });
    prisma.walletFeeConfig.upsert.mockResolvedValue({});

    const small = await service.calculateFee(
      WalletFeeTransactionType.transfer,
      500
    );
    expect(small.feeAmount).toBe(100);

    const large = await service.calculateFee(
      WalletFeeTransactionType.transfer,
      500_000
    );
    expect(large.feeAmount).toBe(2000);
  });
});
