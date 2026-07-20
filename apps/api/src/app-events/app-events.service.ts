import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AppEventName } from "./app-events.constants";

export type TrackAppEventOptions = {
  userId?: string | null;
  /** Si défini, au plus un event avec cette clé (idempotence). */
  dedupeKey?: string;
};

/**
 * Persistance events produit — fire-and-forget.
 * Un échec de tracking ne doit jamais casser le flux métier.
 */
@Injectable()
export class AppEventsService {
  private readonly log = new Logger(AppEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre un event. Résout sans throw (y compris collisions dedupe).
   */
  async track(
    name: AppEventName | string,
    props: Record<string, unknown> = {},
    opts: TrackAppEventOptions = {}
  ): Promise<{ created: boolean }> {
    try {
      if (opts.dedupeKey) {
        const existing = await this.prisma.appEvent.findUnique({
          where: { dedupeKey: opts.dedupeKey },
          select: { id: true }
        });
        if (existing) {
          return { created: false };
        }
      }
      await this.prisma.appEvent.create({
        data: {
          name,
          userId: opts.userId ?? null,
          props: props as Prisma.InputJsonValue,
          dedupeKey: opts.dedupeKey ?? null
        }
      });
      return { created: true };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        opts.dedupeKey
      ) {
        return { created: false };
      }
      this.log.warn(
        `app_event track failed name=${name}: ${(e as Error).message}`
      );
      return { created: false };
    }
  }

  /** Fire-and-forget : n'attend pas, n'expose pas l'erreur au caller. */
  trackFireAndForget(
    name: AppEventName | string,
    props: Record<string, unknown> = {},
    opts: TrackAppEventOptions = {}
  ): void {
    void this.track(name, props, opts);
  }
}
