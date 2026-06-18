import { Test, TestingModule } from "@nestjs/testing";
import { UserWalletEntryKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UserWalletService } from "./user-wallet.service";

describe("UserWalletService", () => {
  let service: UserWalletService;
  let prisma: {
    user: { findUnique: jest.Mock };
    userWallet: {
      upsert: jest.Mock;
      update: jest.Mock;
    };
    userWalletEntry: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      userWallet: {
        upsert: jest.fn(),
        update: jest.fn()
      },
      userWalletEntry: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn()
      },
      $transaction: jest.fn((fn) => fn(prisma))
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserWalletService,
        { provide: PrismaService, useValue: prisma }
      ]
    }).compile();

    service = module.get(UserWalletService);
  });

  it("transfère entre portefeuilles sans frais", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-b" });
    prisma.userWallet.upsert
      .mockResolvedValueOnce({ id: "w-from", balance: 5000, userId: "user-a" })
      .mockResolvedValueOnce({ id: "w-to", balance: 1000, userId: "user-b" });
    prisma.userWallet.update.mockResolvedValue({});
    prisma.userWalletEntry.create
      .mockResolvedValueOnce({
        id: "e-debit",
        kind: UserWalletEntryKind.debit_transfer,
        amount: 2000,
        balanceAfter: 3000,
        currency: "XOF",
        transactionId: null,
        counterpartyUserId: "user-b",
        providerRef: null,
        note: "Transfert",
        createdAt: new Date()
      })
      .mockResolvedValueOnce({
        id: "e-credit",
        kind: UserWalletEntryKind.credit_transfer,
        amount: 2000,
        balanceAfter: 3000,
        currency: "XOF",
        transactionId: null,
        counterpartyUserId: "user-a",
        providerRef: null,
        note: "Transfert",
        createdAt: new Date()
      });

    const result = await service.transfer(
      "user-a",
      "user-b",
      2000,
      "XOF",
      "Transfert test",
      "transfer:test"
    );

    expect(result.debit.amount).toBe(2000);
    expect(result.credit.amount).toBe(2000);
    expect(prisma.userWalletEntry.create).toHaveBeenCalledTimes(2);
  it("refuse un transfert vers son propre numéro", async () => {
    await expect(
      service.resolveTransferRecipientByPhone("user-a", "+2250700000000")
    ).rejects.toThrow("Impossible de transférer vers votre propre numéro");

    prisma.user.findUnique.mockResolvedValue({
      id: "user-a",
      fullName: "Moi",
      firstName: "Moi",
      lastName: "Test",
      phone: "+2250700000000",
      isActive: true,
      accountStatus: "active"
    });

    await expect(
      service.resolveTransferRecipientByPhone("user-a", "+2250700000000")
    ).rejects.toThrow("Impossible de transférer vers votre propre numéro");
  });
});
