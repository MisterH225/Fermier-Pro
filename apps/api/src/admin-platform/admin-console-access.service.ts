import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  type AdminConsoleMenuAccess,
  type AdminConsoleMenuKey,
  hasMenuAccess,
  parseMenuPermissions
} from "./admin-console-menu.constants";
import {
  type InstitutionStatSection,
  type StatSectionAccessProfile,
  hasStatSectionAccess,
  parseStatSectionPermissions,
  resolveStatSections
} from "./institution-stats-sections.constants";

export type ConsoleAccessProfile = StatSectionAccessProfile & {
  institutionLabel: string | null;
  institutionAccessId: string | null;
};

export type EffectiveConsoleContext = {
  profile: ConsoleAccessProfile;
  /** true lorsque le superadmin prévisualise via viewAsInstitutionId */
  isInstitutionPreview: boolean;
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
        statSectionPermissions: "all",
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

    return this.mapInstitutionToProfile(institution);
  }

  async requireConsoleAccess(userId: string): Promise<ConsoleAccessProfile> {
    const profile = await this.getAccessProfile(userId);
    if (!profile) {
      throw new ForbiddenException("Accès console requis");
    }
    return profile;
  }

  /**
   * Résout le profil effectif pour les endpoints stats / health-map.
   * viewAsInstitutionId : réservé au superadmin — retourne le profil institution cible.
   */
  async resolveEffectiveContext(
    userId: string,
    viewAsInstitutionId?: string
  ): Promise<EffectiveConsoleContext> {
    const caller = await this.requireConsoleAccess(userId);
    if (!viewAsInstitutionId?.trim()) {
      return { profile: caller, isInstitutionPreview: false };
    }

    if (caller.role !== "superadmin") {
      throw new ForbiddenException(
        "Le paramètre viewAsInstitutionId est réservé au SuperAdmin"
      );
    }

    const row = await this.getInstitutionRowOrThrow(viewAsInstitutionId.trim());
    if (!row.isActive) {
      throw new ForbiddenException("Institution inactive");
    }

    return {
      profile: this.mapInstitutionToProfile(row),
      isInstitutionPreview: true
    };
  }

  assertStatSectionAllowed(
    context: EffectiveConsoleContext,
    section: InstitutionStatSection
  ): void {
    if (
      context.profile.role === "superadmin" &&
      !context.isInstitutionPreview
    ) {
      return;
    }
    if (!hasStatSectionAccess(context.profile, section, "read")) {
      throw new ForbiddenException(
        `Section statistique « ${section} » non autorisée`
      );
    }
  }

  getVisibleStatSections(context: EffectiveConsoleContext): {
    sections: InstitutionStatSection[];
    isSuperadmin?: boolean;
  } {
    if (
      context.profile.role === "superadmin" &&
      !context.isInstitutionPreview
    ) {
      return {
        sections: resolveStatSections(context.profile),
        isSuperadmin: true
      };
    }
    return { sections: resolveStatSections(context.profile) };
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

  private mapInstitutionToProfile(row: {
    id: string;
    institutionLabel: string | null;
    menuPermissions: unknown;
    statSectionPermissions: unknown;
  }): ConsoleAccessProfile {
    return {
      role: "institution",
      permissions: parseMenuPermissions(row.menuPermissions),
      statSectionPermissions: parseStatSectionPermissions(
        row.statSectionPermissions
      ),
      institutionLabel: row.institutionLabel,
      institutionAccessId: row.id
    };
  }
}
