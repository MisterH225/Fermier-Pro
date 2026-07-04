import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  type AdminConsoleMenuAccess,
  type AdminConsoleMenuKey,
  type AdminConsoleMenuPermissions,
  hasMenuAccess,
  parseMenuPermissions
} from "./admin-console-menu.constants";

export type ConsoleAccessProfile = {
  role: "superadmin" | "institution";
  permissions: AdminConsoleMenuPermissions | "all";
  institutionLabel: string | null;
  institutionAccessId: string | null;
};

@Injectable()
export class AdminConsoleAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessProfile(userId: string): Promise<ConsoleAccessProfile | null> {
    const superAdmin = await this.prisma.superAdmin.findUnique({
      where: { userId }
    });
    if (superAdmin) {
      return {
        role: "superadmin",
        permissions: "all",
        institutionLabel: null,
        institutionAccessId: null
      };
    }

    const institution = await this.prisma.institutionConsoleUser.findUnique({
      where: { userId }
    });
    if (!institution || !institution.isActive) {
      return null;
    }

    return {
      role: "institution",
      permissions: parseMenuPermissions(institution.menuPermissions),
      institutionLabel: institution.institutionLabel,
      institutionAccessId: institution.id
    };
  }

  async requireConsoleAccess(userId: string): Promise<ConsoleAccessProfile> {
    const profile = await this.getAccessProfile(userId);
    if (!profile) {
      throw new ForbiddenException("Accès console requis");
    }
    return profile;
  }

  async requireSuperAdmin(userId: string): Promise<void> {
    const row = await this.prisma.superAdmin.findUnique({ where: { userId } });
    if (!row) {
      throw new ForbiddenException("Accès SuperAdmin requis");
    }
  }

  canAccessMenu(
    profile: ConsoleAccessProfile,
    menu: AdminConsoleMenuKey,
    required: AdminConsoleMenuAccess
  ): boolean {
    return hasMenuAccess(profile.permissions, menu, required);
  }

  async markInstitutionAccepted(userId: string): Promise<void> {
    const row = await this.prisma.institutionConsoleUser.findUnique({
      where: { userId }
    });
    if (!row || row.acceptedAt) {
      return;
    }
    await this.prisma.institutionConsoleUser.update({
      where: { id: row.id },
      data: { acceptedAt: new Date() }
    });
  }

  async assertInstitutionNotSuperAdmin(userId: string): Promise<void> {
    const superAdmin = await this.prisma.superAdmin.findUnique({
      where: { userId }
    });
    if (superAdmin) {
      throw new ForbiddenException(
        "Cet utilisateur est SuperAdmin — utilisez la gestion des administrateurs"
      );
    }
  }

  async assertEmailNotUsedByOtherConsoleRole(
    email: string,
    excludeUserId?: string
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: email.trim().toLowerCase(), mode: "insensitive" },
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {})
      },
      include: {
        superAdmin: true,
        institutionConsoleAccess: true
      }
    });
    if (!user) {
      return;
    }
    if (user.superAdmin) {
      throw new ForbiddenException("Cet email appartient à un SuperAdmin");
    }
    if (user.institutionConsoleAccess) {
      throw new ForbiddenException(
        "Cet email a déjà un accès institution sur la console"
      );
    }
  }

  async getInstitutionRowOrThrow(id: string) {
    const row = await this.prisma.institutionConsoleUser.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            createdAt: true
          }
        }
      }
    });
    if (!row) {
      throw new NotFoundException("Accès institution introuvable");
    }
    return row;
  }
}
