import { Injectable } from "@nestjs/common";
import type { AnimalProductionCategory, Prisma } from "@prisma/client";
import {
  allocateTagCodesInTransaction,
  peekTagCodeRange,
  type AnimalTagPrefix
} from "./allocate-tag-codes";
import { PrismaService } from "../prisma/prisma.service";

export type { AnimalTagPrefix };

const PREFIX_TO_CATEGORY: Record<AnimalTagPrefix, AnimalProductionCategory> = {
  Trui: "breeding_female",
  Ver: "breeding_male",
  Eng: "fattening",
  Dem: "starter",
  All: "nursing"
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
    if (tx) {
      return allocateTagCodesInTransaction(tx, farmId, prefix, count);
    }
    return this.prisma.$transaction((client) =>
      allocateTagCodesInTransaction(client, farmId, prefix, count)
    );
  }

  async previewTagCodeRange(
    farmId: string,
    prefix: AnimalTagPrefix,
    count: number
  ): Promise<{ firstTagCode: string; lastTagCode: string; count: number }> {
    return peekTagCodeRange(this.prisma, farmId, prefix, count);
  }
}
