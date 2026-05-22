import { Injectable } from "@nestjs/common";
import type { AnimalProductionCategory, Prisma } from "@prisma/client";
import { formatTagCode } from "./animal-tag.helper";
import { PrismaService } from "../prisma/prisma.service";

export type AnimalTagPrefix = "Trui" | "Ver" | "Eng" | "Dem";

const PREFIX_TO_COUNTER: Record<
  AnimalTagPrefix,
  "lastTruiTagNumber" | "lastVerTagNumber" | "lastEngTagNumber" | "lastDemTagNumber"
> = {
  Trui: "lastTruiTagNumber",
  Ver: "lastVerTagNumber",
  Eng: "lastEngTagNumber",
  Dem: "lastDemTagNumber"
};

const PREFIX_TO_CATEGORY: Record<AnimalTagPrefix, AnimalProductionCategory> = {
  Trui: "breeding_female",
  Ver: "breeding_male",
  Eng: "fattening",
  Dem: "starter"
};

@Injectable()
export class AnimalProductionTagsService {
  constructor(private readonly prisma: PrismaService) {}

  categoryForPrefix(prefix: AnimalTagPrefix): AnimalProductionCategory {
    return PREFIX_TO_CATEGORY[prefix];
  }

  async nextTagCode(
    farmId: string,
    prefix: AnimalTagPrefix
  ): Promise<string> {
    return this.allocateTagCodes(farmId, prefix, 1).then((codes) => codes[0]);
  }

  async allocateTagCodes(
    farmId: string,
    prefix: AnimalTagPrefix,
    count: number,
    tx?: Prisma.TransactionClient
  ): Promise<string[]> {
    if (count <= 0) {
      return [];
    }
    const client = tx ?? this.prisma;
    const counterKey = PREFIX_TO_COUNTER[prefix];

    const farm = await client.farm.findUniqueOrThrow({
      where: { id: farmId },
      select: {
        lastTruiTagNumber: true,
        lastVerTagNumber: true,
        lastEngTagNumber: true,
        lastDemTagNumber: true
      }
    });

    let seq = farm[counterKey];
    const codes: string[] = [];
    for (let i = 0; i < count; i += 1) {
      seq += 1;
      codes.push(formatTagCode(prefix, seq));
    }

    await client.farm.update({
      where: { id: farmId },
      data: { [counterKey]: seq }
    });

    return codes;
  }
}
