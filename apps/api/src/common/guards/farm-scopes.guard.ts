import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { User } from "@prisma/client";
import { FarmAccessService } from "../farm-access.service";
import { FARM_SCOPES_KEY } from "../decorators/require-farm-scopes.decorator";

@Injectable()
export class FarmScopesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly farmAccess: FarmAccessService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(FARM_SCOPES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required?.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      user?: User;
      params?: { farmId?: string };
    }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException("Session requise");
    }
    const farmId = req.params?.farmId;
    if (!farmId) {
      throw new BadRequestException(
        "farmId manquant pour verifier les permissions"
      );
    }

    await this.farmAccess.requireFarmScopes(user.id, farmId, required);
    return true;
  }
}
