import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: User }>();
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException();
    }
    const row = await this.prisma.superAdmin.findUnique({
      where: { userId: user.id }
    });
    if (!row) {
      throw new ForbiddenException("Accès SuperAdmin requis");
    }
    return true;
  }
}
