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

function slugifyMerchantCategoryName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base.length >= 2 ? base : `cat-${base || "item"}`.slice(0, 80);
}

@Injectable()
export class MerchantCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultCategories = [
    { name: "Alimentation", slug: "alimentation" },
    { name: "Équipement", slug: "equipement" },
    { name: "Matériaux", slug: "materiaux" },
    { name: "Services", slug: "services" },
    { name: "Autre", slug: "autre" }
  ] as const;

  private async ensureDefaultCategories() {
    for (const [index, row] of this.defaultCategories.entries()) {
      await this.prisma.merchantProductCategory.upsert({
        where: { slug: row.slug },
        create: {
          name: row.name,
          slug: row.slug,
          sortOrder: index
        },
        update: {}
      });
    }
  }

  private async resolveUniqueSlug(
    name: string,
    explicitSlug?: string
  ): Promise<string> {
    const base = slugifyMerchantCategoryName(
      explicitSlug?.trim() ? explicitSlug : name
    );
    let candidate = base;
    let suffix = 2;
    while (
      await this.prisma.merchantProductCategory.findUnique({
        where: { slug: candidate },
        select: { id: true }
      })
    ) {
      const suffixPart = `-${suffix++}`;
      candidate = `${base.slice(0, Math.max(2, 80 - suffixPart.length))}${suffixPart}`;
    }
    return candidate;
  }

  private async nextSortOrder(): Promise<number> {
    const agg = await this.prisma.merchantProductCategory.aggregate({
      _max: { sortOrder: true }
    });
    return (agg._max.sortOrder ?? -1) + 1;
  }

  async listPublic() {
    await this.ensureDefaultCategories();
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
    await this.ensureDefaultCategories();
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
    const name = dto.name.trim();
    const slug = await this.resolveUniqueSlug(name, dto.slug);
    const sortOrder =
      dto.sortOrder !== undefined ? dto.sortOrder : await this.nextSortOrder();
    try {
      const row = await this.prisma.merchantProductCategory.create({
        data: {
          name,
          slug,
          sortOrder
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
            ? { slug: slugifyMerchantCategoryName(dto.slug) }
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
