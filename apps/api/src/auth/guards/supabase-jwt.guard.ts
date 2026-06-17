import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { AccountStatus } from "@prisma/client";
import type { Request } from "express";
import { AuthService } from "../auth.service";

/**
 * Routes exemptées du contrôle de statut de compte (le compte banni
 * doit pouvoir lire ses propres informations pour afficher le message
 * de modération dans l'app).
 */
const ACCOUNT_STATUS_EXEMPT_PATHS = new Set([
  "/api/v1/auth/me",
  "/api/v1/health",
  "/api/v1/config/client"
]);

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.auth.extractBearerToken(
      req.headers.authorization as string | undefined
    );
    const payload = await this.auth.verifySupabaseAccessToken(token);
    const user = await this.auth.syncUserFromSupabasePayload(payload);
    req.user = user;
    void this.auth.touchLastActive(user.id);

    // Bloquer les comptes bannis et les suspensions actives sur toutes les
    // routes sauf les exceptions déclarées ci-dessus
    const path = req.path;
    if (!ACCOUNT_STATUS_EXEMPT_PATHS.has(path)) {
      if (user.accountStatus === AccountStatus.banned) {
        throw new ForbiddenException("Compte banni");
      }
      if (
        user.accountStatus === AccountStatus.suspended &&
        user.suspendedUntil != null &&
        user.suspendedUntil > new Date()
      ) {
        throw new ForbiddenException("Compte suspendu");
      }
    }

    return true;
  }
}
