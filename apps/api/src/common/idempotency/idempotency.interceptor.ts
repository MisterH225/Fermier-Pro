import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { User } from "@prisma/client";
import type { Request, Response } from "express";
import { Observable, from, of } from "rxjs";
import { switchMap, tap } from "rxjs/operators";
import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENT_META
} from "./idempotency.constants";
import { IdempotencyService } from "./idempotency.service";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_META, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!enabled) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: User }>();
    const res = http.getResponse<Response>();
    const raw = req.headers[IDEMPOTENCY_HEADER];
    const key = typeof raw === "string" ? raw.trim() : "";
    if (!key) {
      return next.handle();
    }

    const userId = req.user?.id;
    if (!userId) {
      return next.handle();
    }

    const method = (req.method ?? "POST").toUpperCase();
    const path = req.originalUrl ?? req.url ?? "";

    return from(this.prepare(key, userId, method, path)).pipe(
      switchMap((prepared) => {
        if (prepared.kind === "replay") {
          res.status(prepared.statusCode);
          return of(prepared.responseBody);
        }
        return next.handle().pipe(
          tap((body) => {
            const statusCode = res.statusCode || 201;
            void this.idempotency.saveCompleted(
              key,
              userId,
              method,
              path,
              statusCode,
              body
            );
          })
        );
      })
    );
  }

  private async prepare(
    key: string,
    userId: string,
    method: string,
    path: string
  ): Promise<
    | { kind: "replay"; statusCode: number; responseBody: unknown }
    | { kind: "proceed" }
  > {
    const cached = await this.idempotency.findCompleted(key, userId);
    if (cached) {
      return {
        kind: "replay",
        statusCode: cached.statusCode,
        responseBody: cached.responseBody
      };
    }

    const claim = await this.idempotency.claimOrExists(
      key,
      userId,
      method,
      path
    );
    if (claim === "exists") {
      const replay = await this.idempotency.waitForCompleted(key, userId);
      if (replay) {
        return {
          kind: "replay",
          statusCode: replay.statusCode,
          responseBody: replay.responseBody
        };
      }
    }

    return { kind: "proceed" };
  }
}
