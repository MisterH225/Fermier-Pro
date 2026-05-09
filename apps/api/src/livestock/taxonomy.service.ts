import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const PORCIN_CODE = "porcin";

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  async ensurePorcinSpecies(): Promise<void> {
    await this.prisma.species.upsert({
      where: { code: PORCIN_CODE },
      create: { code: PORCIN_CODE, name: "Porcin", sortOrder: 0 },
      update: {}
    });
  }

  async listSpeciesWithBreeds() {
    await this.ensurePorcinSpecies();
    return this.prisma.species.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        breeds: { orderBy: { name: "asc" } }
      }
    });
  }
}
