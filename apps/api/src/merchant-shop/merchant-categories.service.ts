import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateMerchantCategoryDto,
  UpdateMerchantCategoryDto
} from "./dto/merchant-shop.dto";

@Injectable()
export class MerchantCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic() {
    const rows = await this.prisma.merchantProductCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sortOrder: c.sortOrder
    }));
  }

  async listAdmin() {
    const rows = await this.prisma.merchantProductCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString()
    }));
  }

  async create(dto: CreateMerchantCategoryDto) {
    try {
      const row = await this.prisma.merchantProductCategory.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim().toLowerCase(),
          sortOrder: dto.sortOrder ?? 0
        }
      });
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        sortOrder: row.sortOrder,
        isActive: row.isActive
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Slug de catégorie déjà utilisé");
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateMerchantCategoryDto) {
    const existing = await this.prisma.merchantProductCategory.findUnique({
      where: { id }
    });
    if (!existing) {
      throw new NotFoundException("Catégorie introuvable");
    }
    try {
      const row = await this.prisma.merchantProductCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.slug !== undefined
            ? { slug: dto.slug.trim().toLowerCase() }
            : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
        }
      });
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        sortOrder: row.sortOrder,
        isActive: row.isActive
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Slug de catégorie déjà utilisé");
      }
      throw e;
    }
  }

  async remove(id: string) {
    const used = await this.prisma.merchantProduct.count({
      where: { categoryId: id }
    });
    if (used > 0) {
      throw new ConflictException(
        "Impossible de supprimer une catégorie utilisée par des produits"
      );
    }
    await this.prisma.merchantProductCategory.delete({ where: { id } });
    return { ok: true };
  }
}
