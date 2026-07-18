import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { AdminConsoleAccessService } from "./admin-console-access.service";
import {
  isSuperAdminOnlyPath,
  requiredMenuAccessForAdminRequest,
  resolveMenuForAdminPath
} from "./admin-console-menu.constants";

/** Vérifie les permissions menu (lecture / écriture) sur les routes /admin/*. */
@Injectable()
export class AdminConsoleMenuGuard implements CanActivate {
  constructor(private readonly access: AdminConsoleAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: User;
      method?: string;
      path?: string;
      url?: string;
      consoleAccess?: Awaited<
        ReturnType<AdminConsoleAccessService["getAccessProfile"]>
      >;
    }>();
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException();
    }

    const profile =
      req.consoleAccess ?? (await this.access.getAccessProfile(user.id));
    if (!profile) {
      throw new ForbiddenException("Accès console requis");
    }

    const rawPath = req.path ?? req.url ?? "";
    if (isSuperAdminOnlyPath(rawPath)) {
      if (profile.role !== "superadmin") {
        throw new ForbiddenException("Accès SuperAdmin requis");
      }
      return true;
    }

    if (profile.role === "superadmin") {
      return true;
    }

    const menu = resolveMenuForAdminPath(rawPath);
    if (!menu) {
      throw new ForbiddenException("Route admin non autorisée");
    }

    const required = requiredMenuAccessForAdminRequest(
      req.method ?? "GET",
      rawPath
    );
    if (!this.access.canAccessMenu(profile, menu, required)) {
      throw new ForbiddenException(
        `Permission insuffisante sur le menu « ${menu} » (${required})`
      );
    }

    return true;
  }
}
