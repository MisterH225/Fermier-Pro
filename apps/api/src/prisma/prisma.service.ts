import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { installMerchantCatalogDeleteGuard } from "../merchant-shop/merchant-catalog-protection";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly log = new Logger(PrismaService.name);
  private connectPromise: Promise<void> | null = null;

  constructor() {
    super();
    installMerchantCatalogDeleteGuard(this);
  }

  async onModuleInit(): Promise<void> {
    // Ne pas bloquer app.listen() — le healthcheck Railway doit répondre même si la DB est lente.
    void this.ensureConnected();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Attend la connexion DB (retry en arrière-plan depuis le boot). */
  async ensureConnected(): Promise<void> {
    if (!this.connectPromise) {
      this.connectPromise = this.connectWithRetry();
    }
    await this.connectPromise;
  }

  private async connectWithRetry(attempt = 1): Promise<void> {
    try {
      await this.$connect();
      this.log.log("Connecté à la base de données.");
    } catch (err) {
      const delayMs = Math.min(30_000, 1000 * attempt);
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(
        `Connexion DB échouée (tentative ${attempt}) — nouvel essai dans ${delayMs}ms : ${message}`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return this.connectWithRetry(attempt + 1);
    }
  }
}
