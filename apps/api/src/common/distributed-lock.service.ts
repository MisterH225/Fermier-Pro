import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Verrou distribué via pg_try_advisory_lock (session Postgres).
 * Empêche l'exécution concurrente des crons sur plusieurs instances Railway.
 */
@Injectable()
export class DistributedLockService {
  private readonly log = new Logger(DistributedLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tente d'acquérir un verrou nommé. Retourne true si acquis.
   * Le verrou est libéré automatiquement à la fin de la session Prisma
   * ou explicitement via release().
   */
  async tryAcquire(lockKey: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ pg_try_advisory_lock: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${lockKey}))
    `;
    const acquired = rows[0]?.pg_try_advisory_lock === true;
    if (!acquired) {
      this.log.debug(`Verrou occupé — skip: ${lockKey}`);
    }
    return acquired;
  }

  async release(lockKey: string): Promise<void> {
    await this.prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext(${lockKey}))`;
  }

  /**
   * Exécute fn uniquement si le verrou est acquis ; libère en finally.
   */
  async withLock(lockKey: string, fn: () => Promise<void>): Promise<boolean> {
    const acquired = await this.tryAcquire(lockKey);
    if (!acquired) {
      return false;
    }
    try {
      await fn();
      return true;
    } finally {
      await this.release(lockKey);
    }
  }
}
