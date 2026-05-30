import { Injectable } from "@nestjs/common";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AnimalAgeInput, PenAgeData } from "./age-calculation.types";
import {
  buildPenAgeData,
  calculateAnimalAgeWeeks as calcAnimalAgeWeeks
} from "./age-calculation.util";

const activeAnimalAgeSelect = {
  birthDate: true,
  ageWeeksAtEntry: true,
  entryDate: true,
  status: true
} as const;

@Injectable()
export class AgeCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  calculateAnimalAgeWeeks(
    animal: AnimalAgeInput,
    referenceDate?: Date
  ): number | null {
    return calcAnimalAgeWeeks(animal, referenceDate);
  }

  private mapAnimalRow(a: {
    birthDate: Date | null;
    ageWeeksAtEntry: number | null;
    entryDate: Date | null;
  }): AnimalAgeInput {
    return {
      birthDate: a.birthDate,
      ageWeeksAtEntry: a.ageWeeksAtEntry,
      entryDate: a.entryDate
    };
  }

  async loadActivePenAnimalsForAge(
    tx: PrismaTypes.TransactionClient | PrismaService,
    penId: string
  ): Promise<AnimalAgeInput[]> {
    const placements = await tx.penPlacement.findMany({
      where: { penId, endedAt: null, animalId: { not: null } },
      select: {
        animal: { select: activeAnimalAgeSelect }
      }
    });

    const out: AnimalAgeInput[] = [];
    for (const pl of placements) {
      if (!pl.animal || pl.animal.status !== "active") {
        continue;
      }
      out.push(this.mapAnimalRow(pl.animal));
    }
    return out;
  }

  async calculatePenAverageAgeWeeks(
    penId: string,
    referenceDate?: Date
  ): Promise<PenAgeData> {
    const pen = await this.prisma.pen.findUnique({
      where: { id: penId },
      select: { averageAgeWeeksManual: true }
    });
    const animals = await this.loadActivePenAnimalsForAge(this.prisma, penId);
    return buildPenAgeData(
      animals,
      pen?.averageAgeWeeksManual ?? null,
      referenceDate
    );
  }

  buildPenAgeDataFromAnimals(
    animals: AnimalAgeInput[],
    averageAgeWeeksManual: number | null,
    referenceDate?: Date
  ): PenAgeData {
    return buildPenAgeData(animals, averageAgeWeeksManual, referenceDate);
  }

  /**
   * Recalcul dynamique après transfert — l'âge moyen n'est pas persisté ;
   * utilisé pour déclencher la vérification de requalification (SmartAlerts).
   */
  async recalculatePenAverageAfterTransfer(
    sourcePenId: string,
    destinationPenId: string
  ): Promise<{ source: PenAgeData; destination: PenAgeData }> {
    const [source, destination] = await Promise.all([
      this.calculatePenAverageAgeWeeks(sourcePenId),
      this.calculatePenAverageAgeWeeks(destinationPenId)
    ]);
    return { source, destination };
  }
}
