import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CGU_DEFAULT_CONTENT,
  CGU_DEFAULT_VERSION,
  PRIVACY_POLICY_CONTENT
} from "./cgu-default-content";

const SETTINGS_ID = "current";

export type CguCurrentDto = {
  version: string;
  content: string;
  contentUrl: string | null;
  updatedAt: string;
  privacyPolicyContent: string;
};

export type CguStatusDto = {
  currentVersion: string;
  acceptedAt: string | null;
  versionAccepted: string | null;
  needsAcceptance: boolean;
  isUpdate: boolean;
};

@Injectable()
export class CguService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureSettingsRow() {
    await this.prisma.cguSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        currentVersion: CGU_DEFAULT_VERSION,
        content: CGU_DEFAULT_CONTENT
      },
      update: {}
    });
    const existing = await this.prisma.cguSettings.findUnique({
      where: { id: SETTINGS_ID }
    });
    if (!existing) {
      return;
    }
    // Contenu vide ou version applicative plus récente → synchroniser le texte légal.
    if (
      !existing.content?.trim() ||
      existing.currentVersion !== CGU_DEFAULT_VERSION
    ) {
      await this.prisma.cguSettings.update({
        where: { id: SETTINGS_ID },
        data: {
          content: CGU_DEFAULT_CONTENT,
          currentVersion: CGU_DEFAULT_VERSION
        }
      });
    }
  }

  async getCurrent(): Promise<CguCurrentDto> {
    await this.ensureSettingsRow();
    const row = await this.prisma.cguSettings.findUniqueOrThrow({
      where: { id: SETTINGS_ID }
    });
    return {
      version: row.currentVersion,
      content: row.content,
      contentUrl: row.contentUrl,
      updatedAt: row.updatedAt.toISOString(),
      privacyPolicyContent: PRIVACY_POLICY_CONTENT
    };
  }

  /**
   * CGU acceptées une seule fois par compte (première connexion).
   * Nouvelle acceptation uniquement si l'utilisateur a supprimé son compte puis recréé un compte.
   * Une mise à jour de version des CGU ne déclenche pas de ré-acceptation.
   */
  buildStatusForUser(user: User, currentVersion: string): CguStatusDto {
    const versionAccepted = user.cguVersionAccepted;
    const acceptedAt = user.cguAcceptedAt;
    const needsAcceptance = acceptedAt == null;
    return {
      currentVersion,
      acceptedAt: acceptedAt?.toISOString() ?? null,
      versionAccepted,
      needsAcceptance,
      isUpdate: false
    };
  }

  async getStatusForUser(userId: string): Promise<CguStatusDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Utilisateur introuvable");
    }
    const current = await this.getCurrent();
    return this.buildStatusForUser(user, current.version);
  }

  async acceptCgu(userId: string, version: string): Promise<CguStatusDto> {
    const current = await this.getCurrent();
    if (version !== current.version) {
      throw new BadRequestException(
        `Version CGU invalide — version courante : ${current.version}`
      );
    }
    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId }
    });
    if (existing.cguAcceptedAt != null) {
      return this.buildStatusForUser(existing, current.version);
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        cguAcceptedAt: new Date(),
        cguVersionAccepted: current.version
      }
    });
    return this.buildStatusForUser(user, current.version);
  }
}
