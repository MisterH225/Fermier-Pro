import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateProfitabilitySettingsDto } from "./dto/update-profitability-settings.dto";
import { ProfitabilityEngine } from "./profitability-engine";
import type { ProductionPhaseKey } from "./profitability.types";

@Injectable()
export class ProfitabilityService {
  private readonly engine: ProfitabilityEngine;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {
    this.engine = new ProfitabilityEngine(prisma);
  }

  private monthRef(month?: number, year?: number) {
    const now = new Date();
    return {
      month: month ?? now.getUTCMonth() + 1,
      year: year ?? now.getUTCFullYear()
    };
  }

  async getSettings(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeRead
    ]);
    const row = await this.engine.ensureSettings(farmId);
    return this.mapSettings(row);
  }

  async updateSettings(
    user: User,
    farmId: string,
    dto: UpdateProfitabilitySettingsDto
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeWrite
    ]);
    await this.engine.ensureSettings(farmId);
    const data: Prisma.FarmProfitabilitySettingsUpdateInput = {};
    if (dto.marketPricePerKg !== undefined) {
      data.marketPricePerKg =
        dto.marketPricePerKg == null
          ? null
          : new Prisma.Decimal(dto.marketPricePerKg);
    }
    if (dto.icTargetStarter != null) {
      data.icTargetStarter = new Prisma.Decimal(dto.icTargetStarter);
    }
    if (dto.icTargetGrowth != null) {
      data.icTargetGrowth = new Prisma.Decimal(dto.icTargetGrowth);
    }
    if (dto.icTargetFattening != null) {
      data.icTargetFattening = new Prisma.Decimal(dto.icTargetFattening);
    }
    if (dto.gmqRefStarter != null) data.gmqRefStarter = dto.gmqRefStarter;
    if (dto.gmqRefGrowth != null) data.gmqRefGrowth = dto.gmqRefGrowth;
    if (dto.gmqRefFattening != null) data.gmqRefFattening = dto.gmqRefFattening;

    const row = await this.prisma.farmProfitabilitySettings.update({
      where: { farmId },
      data
    });
    return this.mapSettings(row);
  }

  private mapSettings(row: {
    farmId: string;
    marketPricePerKg: Prisma.Decimal | null;
    icTargetStarter: Prisma.Decimal;
    icTargetGrowth: Prisma.Decimal;
    icTargetFattening: Prisma.Decimal;
    gmqRefStarter: number;
    gmqRefGrowth: number;
    gmqRefFattening: number;
  }) {
    const n = (d: Prisma.Decimal | null) =>
      d != null ? Number(d.toString()) : null;
    return {
      farmId: row.farmId,
      marketPricePerKg: n(row.marketPricePerKg),
      icTargetStarter: Number(row.icTargetStarter.toString()),
      icTargetGrowth: Number(row.icTargetGrowth.toString()),
      icTargetFattening: Number(row.icTargetFattening.toString()),
      gmqRefStarter: row.gmqRefStarter,
      gmqRefGrowth: row.gmqRefGrowth,
      gmqRefFattening: row.gmqRefFattening
    };
  }

  async getPeriod(
    user: User,
    farmId: string,
    month?: number,
    year?: number
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeRead
    ]);
    const ref = this.monthRef(month, year);
    return this.engine.calculatePeriod(farmId, ref, true);
  }

  async forceCalculate(
    user: User,
    farmId: string,
    month?: number,
    year?: number
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeWrite
    ]);
    const ref = this.monthRef(month, year);
    return this.engine.calculatePeriod(farmId, ref, true);
  }

  async getHistory(user: User, farmId: string, months = 6) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeRead
    ]);
    const ref = this.monthRef();
    await this.engine.calculatePeriod(farmId, ref, true);
    const hist = await this.engine.getHistory(farmId, months);
    if (hist.length < months) {
      for (let i = months - 1; i >= 0; i -= 1) {
        const d = new Date();
        d.setUTCMonth(d.getUTCMonth() - i);
        const m = {
          year: d.getUTCFullYear(),
          month: d.getUTCMonth() + 1
        };
        const exists = hist.some(
          (h) => h.periodYear === m.year && h.periodMonth === m.month
        );
        if (!exists) {
          await this.engine.calculatePeriod(farmId, m, true);
        }
      }
      return this.engine.getHistory(farmId, months);
    }
    return hist;
  }

  async getIcByPhase(
    user: User,
    farmId: string,
    phase?: string,
    month?: number,
    year?: number
  ) {
    const data = await this.getPeriod(user, farmId, month, year);
    if (!phase) {
      return data.icByPhase;
    }
    const key = phase as ProductionPhaseKey;
    if (!["starter", "growth", "fattening"].includes(key)) {
      throw new BadRequestException("Phase invalide");
    }
    return data.icByPhase[key];
  }

  async simulate(
    user: User,
    farmId: string,
    param: string,
    value: number,
    month?: number,
    year?: number
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeRead
    ]);
    const base = await this.engine.calculatePeriod(
      farmId,
      this.monthRef(month, year),
      false
    );
    return this.engine.simulate(base, param, value);
  }
}
