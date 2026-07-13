import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IDEMPOTENCY_TTL_MS } from "./idempotency.constants";

export type IdempotencyReplay = {
  statusCode: number;
  responseBody: unknown;
};

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async findCompleted(
    key: string,
    userId: string
  ): Promise<IdempotencyReplay | null> {
    const row = await this.prisma.idempotencyKey.findUnique({
      where: { key }
    });
    if (!row || row.userId !== userId) {
      return null;
    }
    if (row.statusCode <= 0 || row.responseBody == null) {
      return null;
    }
    return {
      statusCode: row.statusCode,
      responseBody: row.responseBody
    };
  }

  /**
   * Réserve la clé (statusCode=0) ou indique qu'elle existe déjà.
   * @returns `claimed` si on doit exécuter le handler, `exists` sinon.
   */
  async claimOrExists(
    key: string,
    userId: string,
    method: string,
    path: string
  ): Promise<"claimed" | "exists"> {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          userId,
          method,
          path,
          statusCode: 0,
          responseBody: Prisma.DbNull,
          expiresAt
        }
      });
      return "claimed";
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return "exists";
      }
      throw e;
    }
  }

  async saveCompleted(
    key: string,
    userId: string,
    method: string,
    path: string,
    statusCode: number,
    responseBody: unknown
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);
    await this.prisma.idempotencyKey.upsert({
      where: { key },
      create: {
        key,
        userId,
        method,
        path,
        statusCode,
        responseBody:
          responseBody === undefined
            ? Prisma.DbNull
            : (responseBody as Prisma.InputJsonValue),
        expiresAt
      },
      update: {
        statusCode,
        responseBody:
          responseBody === undefined
            ? Prisma.DbNull
            : (responseBody as Prisma.InputJsonValue),
        expiresAt
      }
    });
  }

  /** Attend qu'une clé concurrente soit finalisée (rejeu). */
  async waitForCompleted(
    key: string,
    userId: string,
    attempts = 20,
    delayMs = 50
  ): Promise<IdempotencyReplay | null> {
    for (let i = 0; i < attempts; i++) {
      const done = await this.findCompleted(key, userId);
      if (done) {
        return done;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return this.findCompleted(key, userId);
  }
}
