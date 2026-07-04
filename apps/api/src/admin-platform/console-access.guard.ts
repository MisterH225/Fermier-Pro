import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { AdminConsoleAccessService } from "./admin-console-access.service";

/** Autorise SuperAdmin ou utilisateur institution actif. */
@Injectable()
export class ConsoleAccessGuard implements CanActivate {
  constructor(private readonly access: AdminConsoleAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: User;
      consoleAccess?: Awaited<
        ReturnType<AdminConsoleAccessService["getAccessProfile"]>
      >;
    }>();
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException();
    }
    const profile = await this.access.requireConsoleAccess(user.id);
    req.consoleAccess = profile;
    return true;
  }
}
