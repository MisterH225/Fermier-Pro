import { Injectable, Logger } from "@nestjs/common";
import {
  ListingStatus,
  PigPriceIndexCategory,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PigPriceIndexCacheService } from "./pig-price-index-cache.service";
import { SmartAlertsService } from "../smart-alerts/smart-alerts.service";
import {
  listingHeadcount
} from "../marketplace/marketplace-listing-category.helper";
import {
  addSaleToBucket,
  addUtcDays,
  avgFromListingBucket,
  categoryFromListing,
  categoryFromSale,
  categoryLabelFr,
  emptyListingBucket,
  emptySaleBucket,
  LISTING_CURVE_COLOR,
  MIN_POINTS_FOR_INDEX,
  MIN_TRANSACTIONS_FOR_POINT,
  parseCategory,
  parsePeriod,
  periodToDays,
  PIG_PRICE_CATEGORY_COLORS,
  startOfUtcDay,
  type ListingBucket,
  type PigPriceIndexPeriod,
  type SaleBucket,
  weightedAvgFromBucket
} from "./pig-price-index.types";

type DailyRow = {
  date: Date;
  category: PigPriceIndexCategory;
  avgPricePerKg: Prisma.Decimal;
  weightedAvgPrice: Prisma.Decimal;
  minPrice: Prisma.Decimal | null;
  maxPrice: Prisma.Decimal | null;
  transactionCount: number;
  listingAvgPrice: Prisma.Decimal | null;
  listingCount: number;
  variationPct: Prisma.Decimal | null;
};

export type PigPriceIndexPointDto = {
  date: string;
  avgPricePerKg: number;
  listingAvgPrice: number | null;
  transactionCount: number;
  variationPct: number | null;
  limitedData: boolean;
};

export type PigPriceIndexSeriesDto = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  points: PigPriceIndexPointDto[];
};

export type PigPriceIndexChartDto = {
  period: PigPriceIndexPeriod;
  category: PigPriceIndexCategory | "all";
  insufficientData: boolean;
  message: string | null;
  series: PigPriceIndexSeriesDto[];
  updatedAt: string;
};

export type PigPriceIndexTickerItemDto = {
  category: PigPriceIndexCategory;
  label: string;
  icon: string;
  pricePerKg: number | null;
  variationPct: number | null;
  color: string;
};

export type PigPriceIndexTickerDto = {
  items: PigPriceIndexTickerItemDto[];
  updatedAt: string;
};

export type PigPriceIndexTodayItemDto = {
  category: PigPriceIndexCategory;
  label: string;
  pricePerKg: number | null;
  variationPct: number | null;
  transactionCount: number;
  listingAvgPrice: number | null;
  insufficientData: boolean;
};

export type PigPriceIndexStatsRowDto = {
  category: PigPriceIndexCategory;
  label: string;
  todayPrice: number | null;
  variation24h: number | null;
  variation7d: number | null;
  high30d: number | null;
  low30d: number | null;
  volume: number;
};

const CATEGORY_ICONS: Record<
  Exclude<PigPriceIndexCategory, "global">,
  string
> = {
  porcelet: "🐣",
  croissance: "📈",
  charcutier: "🐷",
  reproducteur: "♻️"
};

const INDEX_CATEGORIES: PigPriceIndexCategory[] = [
  PigPriceIndexCategory.porcelet,
  PigPriceIndexCategory.croissance,
  PigPriceIndexCategory.charcutier,
  PigPriceIndexCategory.reproducteur
];

function dec(n: number | null | undefined): Prisma.Decimal | null {
  if (n == null || !Number.isFinite(n)) {
    return null;
  }
  return new Prisma.Decimal(n);
}

function num(d: Prisma.Decimal | null | undefined): number | null {
  if (d == null) {
    return null;
  }
  return Number(d);
}

@Injectable()
export class PigPriceIndexService {
  private readonly log = new Logger(PigPriceIndexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PigPriceIndexCacheService,
    private readonly smartAlerts: SmartAlertsService
  ) {}

  cacheKey(suffix: string): string {
    return `pig_price_index:${suffix}`;
  }

  async invalidateAll(): Promise<void> {
    await this.cache.invalidatePrefix("pig_price_index:");
  }

  /** Recalcule l'indice pour une journée UTC (toutes catégories + global). */
  async calculateForDate(day: Date): Promise<void> {
    const date = startOfUtcDay(day);
    const next = addUtcDays(date, 1);

    const sales = await this.prisma.animal.findMany({
      where: {
        status: "sold",
        soldAt: { gte: date, lt: next },
        soldWeightKg: { gt: 0 },
        soldPrice: { gt: 0 }
      },
      select: {
        soldPrice: true,
        soldWeightKg: true,
        productionCategory: true
      }
    });


    const soldListings = await this.prisma.marketplaceListing.findMany({
      where: {
        status: ListingStatus.sold,
        totalPrice: { gt: 0 },
        totalWeightKg: { gt: 0 },
        updatedAt: { gte: date, lt: next }
      },
      select: {
        totalPrice: true,
        totalWeightKg: true,
        category: true,
        quantity: true,
        animalId: true,
        animalIds: true,
        animal: { select: { productionCategory: true } }
      }
    });

    const priceSnapshots = await this.prisma.pigPriceSnapshot.findMany({
      where: { soldAt: { gte: date, lt: next } },
      select: {
        pricePerKg: true,
        weightKg: true,
        category: true
      }
    });
    const listings = await this.prisma.marketplaceListing.findMany({
      where: {
        status: ListingStatus.published,
        pricePerKg: { not: null },
        OR: [
          { publishedAt: { gte: date, lt: next } },
          {
            publishedAt: null,
            createdAt: { gte: date, lt: next }
          }
        ]
      },
      select: {
        pricePerKg: true,
        category: true,
        totalWeightKg: true,
        quantity: true,
        animalId: true,
        animalIds: true,
        animal: { select: { productionCategory: true } }
      }
    });

    const saleBuckets = new Map<PigPriceIndexCategory, SaleBucket>();
    const listingBuckets = new Map<PigPriceIndexCategory, ListingBucket>();

    for (const cat of [...INDEX_CATEGORIES, PigPriceIndexCategory.global]) {
      saleBuckets.set(cat, emptySaleBucket());
      listingBuckets.set(cat, emptyListingBucket());
    }

    for (const s of sales) {
      const price = Number(s.soldPrice);
      const weight = Number(s.soldWeightKg);
      if (!Number.isFinite(price) || !Number.isFinite(weight) || weight <= 0) {
        continue;
      }
      const globalBucket = saleBuckets.get(PigPriceIndexCategory.global)!;
      addSaleToBucket(globalBucket, price, weight);

      const cat = categoryFromSale(s.productionCategory, weight);
      if (cat) {
        addSaleToBucket(saleBuckets.get(cat)!, price, weight);
      }
    }


    for (const sl of soldListings) {
      const price = Number(sl.totalPrice);
      const weight = Number(sl.totalWeightKg);
      if (!Number.isFinite(price) || !Number.isFinite(weight) || weight <= 0) {
        continue;
      }
      const globalBucket = saleBuckets.get(PigPriceIndexCategory.global)!;
      addSaleToBucket(globalBucket, price, weight);
      const animalIds = Array.isArray(sl.animalIds)
        ? (sl.animalIds as unknown[]).filter(
            (x): x is string => typeof x === "string" && x.length > 0
          )
        : [];
      const headcount = listingHeadcount(
        animalIds,
        sl.animalId,
        sl.quantity
      );
      const cat =
        categoryFromListing(
          sl.category,
          weight,
          headcount,
          sl.animal?.productionCategory ?? null
        ) ?? categoryFromSale(sl.animal?.productionCategory ?? "unknown", weight);
      if (cat && cat !== PigPriceIndexCategory.global) {
        addSaleToBucket(saleBuckets.get(cat)!, price, weight);
      }
    }

    for (const snap of priceSnapshots) {
      const pricePerKg = Number(snap.pricePerKg);
      const weight = Number(snap.weightKg);
      if (
        !Number.isFinite(pricePerKg) ||
        !Number.isFinite(weight) ||
        weight <= 0
      ) {
        continue;
      }
      const price = pricePerKg * weight;
      const globalBucket = saleBuckets.get(PigPriceIndexCategory.global)!;
      addSaleToBucket(globalBucket, price, weight);
      if (snap.category !== PigPriceIndexCategory.global) {
        addSaleToBucket(saleBuckets.get(snap.category)!, price, weight);
      }
    }
    for (const l of listings) {
      const pricePerKg = Number(l.pricePerKg);
      if (!Number.isFinite(pricePerKg)) {
        continue;
      }
      const animalIds = Array.isArray(l.animalIds)
        ? (l.animalIds as unknown[]).filter(
            (x): x is string => typeof x === "string" && x.length > 0
          )
        : [];
      const headcount = listingHeadcount(
        animalIds,
        l.animalId,
        l.quantity
      );
      const weight =
        l.totalWeightKg != null ? Number(l.totalWeightKg) : null;
      const cat = categoryFromListing(
        l.category,
        weight,
        headcount,
        l.animal?.productionCategory ?? null
      );
      if (!cat) {
        continue;
      }
      const bucket = listingBuckets.get(cat)!;
      bucket.sumPricePerKg += pricePerKg;
      bucket.count += 1;
    }

    for (const cat of [...INDEX_CATEGORIES, PigPriceIndexCategory.global]) {
      const sale = saleBuckets.get(cat)!;
      const listing = listingBuckets.get(cat)!;
      const weighted = weightedAvgFromBucket(sale);
      const simpleAvg =
        sale.count > 0 && sale.minPricePerKg != null && sale.maxPricePerKg != null
          ? (sale.minPricePerKg + sale.maxPricePerKg) / 2
          : weighted;

      const listingAvg = avgFromListingBucket(listing);

      if (weighted == null && listingAvg == null) {
        await this.prisma.pigPriceIndexDaily.deleteMany({
          where: { date, category: cat }
        });
        continue;
      }

      const prev = await this.prisma.pigPriceIndexDaily.findUnique({
        where: { date_category: { date: addUtcDays(date, -1), category: cat } }
      });
      const prevWeighted = prev ? Number(prev.weightedAvgPrice) : null;
      const w = weighted ?? listingAvg ?? 0;
      const variationPct =
        prevWeighted != null && prevWeighted > 0 && weighted != null
          ? ((weighted - prevWeighted) / prevWeighted) * 100
          : null;

      await this.prisma.pigPriceIndexDaily.upsert({
        where: { date_category: { date, category: cat } },
        create: {
          date,
          category: cat,
          avgPricePerKg: dec(simpleAvg ?? w)!,
          weightedAvgPrice: dec(weighted ?? w)!,
          minPrice: dec(sale.minPricePerKg),
          maxPrice: dec(sale.maxPricePerKg),
          transactionCount: sale.count,
          listingAvgPrice: dec(listingAvg),
          listingCount: listing.count,
          variationPct: dec(variationPct),
          calculatedAt: new Date()
        },
        update: {
          avgPricePerKg: dec(simpleAvg ?? w)!,
          weightedAvgPrice: dec(weighted ?? w)!,
          minPrice: dec(sale.minPricePerKg),
          maxPrice: dec(sale.maxPricePerKg),
          transactionCount: sale.count,
          listingAvgPrice: dec(listingAvg),
          listingCount: listing.count,
          variationPct: dec(variationPct),
          calculatedAt: new Date()
        }
      });
    }

    await this.invalidateAll();
  }

  /** Recalcule aujourd'hui + hier (finalisation variation). */
  async calculateRecentDays(): Promise<void> {
    const today = startOfUtcDay(new Date());
    await this.calculateForDate(today);
    await this.calculateForDate(addUtcDays(today, -1));
    await this.smartAlerts.syncMarketAlertsGlobally();
  }

  async getChart(
    periodRaw?: string,
    categoryRaw?: string
  ): Promise<PigPriceIndexChartDto> {
    const period = parsePeriod(periodRaw);
    const category = parseCategory(categoryRaw);
    const cacheKey = this.cacheKey(`chart:${category}:${period}`);
    const cached = await this.cache.get<PigPriceIndexChartDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const end = startOfUtcDay(new Date());
    const start = addUtcDays(end, -periodToDays(period) + 1);
    await this.ensureRangeCalculated(start, end);

    const categories =
      category === "all"
        ? INDEX_CATEGORIES
        : [category as PigPriceIndexCategory];

    const rows = await this.prisma.pigPriceIndexDaily.findMany({
      where: {
        date: { gte: start, lte: end },
        category: { in: categories }
      },
      orderBy: { date: "asc" }
    });

    const series: PigPriceIndexSeriesDto[] = [];
    for (const cat of categories) {
      const catRows = rows.filter((r) => r.category === cat);
      const points = this.aggregatePoints(catRows, period);
      const color =
        cat === PigPriceIndexCategory.global
          ? "#888888"
          : PIG_PRICE_CATEGORY_COLORS[
              cat as Exclude<PigPriceIndexCategory, "global">
            ];
      series.push({
        key: cat,
        label: categoryLabelFr(cat),
        color,
        points
      });

      if (category !== "all" && cat !== PigPriceIndexCategory.global) {
        const listingPoints = points.map((p) => ({
          ...p,
          avgPricePerKg: p.listingAvgPrice ?? p.avgPricePerKg
        }));
        series.push({
          key: `${cat}_listings`,
          label: "Prix demandés",
          color: LISTING_CURVE_COLOR,
          dashed: true,
          points: listingPoints.filter((p) => p.listingAvgPrice != null)
        });
      }
    }

    const validPoints = series.flatMap((s) =>
      s.dashed ? [] : s.points.filter((p) => !p.limitedData)
    );
    const insufficientData = validPoints.length < MIN_POINTS_FOR_INDEX;

    const result: PigPriceIndexChartDto = {
      period,
      category,
      insufficientData,
      message: insufficientData
        ? "Données insuffisantes pour afficher l'indice sur cette période."
        : null,
      series,
      updatedAt: new Date().toISOString()
    };
    await this.cache.set(cacheKey, result);
    return result;
  }

  async getTicker(): Promise<PigPriceIndexTickerDto> {
    const cacheKey = this.cacheKey("ticker");
    const cached = await this.cache.get<PigPriceIndexTickerDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const today = startOfUtcDay(new Date());
    await this.calculateForDate(today);

    const rows = await this.prisma.pigPriceIndexDaily.findMany({
      where: {
        date: today,
        category: { in: INDEX_CATEGORIES }
      }
    });

    const items: PigPriceIndexTickerItemDto[] = INDEX_CATEGORIES.map((cat) => {
      const row = rows.find((r) => r.category === cat);
      const icon =
        CATEGORY_ICONS[cat as Exclude<PigPriceIndexCategory, "global">];
      return {
        category: cat,
        label: categoryLabelFr(cat),
        icon,
        pricePerKg:
          row && row.transactionCount >= MIN_TRANSACTIONS_FOR_POINT
            ? num(row.weightedAvgPrice)
            : row
              ? num(row.weightedAvgPrice)
              : null,
        variationPct: num(row?.variationPct ?? null),
        color:
          PIG_PRICE_CATEGORY_COLORS[
            cat as Exclude<PigPriceIndexCategory, "global">
          ]
      };
    });

    const result = { items, updatedAt: new Date().toISOString() };
    await this.cache.set(cacheKey, result);
    return result;
  }

  async getToday(): Promise<{ items: PigPriceIndexTodayItemDto[]; updatedAt: string }> {
    const cacheKey = this.cacheKey("today");
    const cached = await this.cache.get<{
      items: PigPriceIndexTodayItemDto[];
      updatedAt: string;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const today = startOfUtcDay(new Date());
    await this.calculateForDate(today);

    const rows = await this.prisma.pigPriceIndexDaily.findMany({
      where: {
        date: today,
        category: { in: INDEX_CATEGORIES }
      }
    });

    const items: PigPriceIndexTodayItemDto[] = INDEX_CATEGORIES.map((cat) => {
      const row = rows.find((r) => r.category === cat);
      const count = row?.transactionCount ?? 0;
      return {
        category: cat,
        label: categoryLabelFr(cat),
        pricePerKg: num(row?.weightedAvgPrice ?? null),
        variationPct: num(row?.variationPct ?? null),
        transactionCount: count,
        listingAvgPrice: num(row?.listingAvgPrice ?? null),
        insufficientData: count < MIN_TRANSACTIONS_FOR_POINT
      };
    });

    const result = { items, updatedAt: new Date().toISOString() };
    await this.cache.set(cacheKey, result);
    return result;
  }

  async getStats(periodRaw?: string): Promise<{ rows: PigPriceIndexStatsRowDto[] }> {
    const period = parsePeriod(periodRaw);
    const cacheKey = this.cacheKey(`stats:${period}`);
    const cached = await this.cache.get<{ rows: PigPriceIndexStatsRowDto[] }>(
      cacheKey
    );
    if (cached) {
      return cached;
    }

    const end = startOfUtcDay(new Date());
    const start = addUtcDays(end, -periodToDays(period) + 1);
    const start30 = addUtcDays(end, -29);
    const start7 = addUtcDays(end, -6);
    const yesterday = addUtcDays(end, -1);

    await this.ensureRangeCalculated(start30, end);

    const rows = await this.prisma.pigPriceIndexDaily.findMany({
      where: {
        date: { gte: start30, lte: end },
        category: { in: INDEX_CATEGORIES }
      },
      orderBy: { date: "asc" }
    });

    const resultRows: PigPriceIndexStatsRowDto[] = INDEX_CATEGORIES.map(
      (cat) => {
        const catRows = rows.filter((r) => r.category === cat);
        const todayRow = catRows.find(
          (r) => r.date.getTime() === end.getTime()
        );
        const yesterdayRow = catRows.find(
          (r) => r.date.getTime() === yesterday.getTime()
        );
        const weekStartRow = catRows.find(
          (r) => r.date.getTime() === start7.getTime()
        );

        const periodRows = catRows.filter(
          (r) => r.date >= start && r.date <= end
        );
        const prices = periodRows
          .filter((r) => r.transactionCount >= MIN_TRANSACTIONS_FOR_POINT)
          .map((r) => Number(r.weightedAvgPrice));
        const volume = periodRows.reduce(
          (s, r) => s + r.transactionCount,
          0
        );

        const todayPrice = todayRow ? num(todayRow.weightedAvgPrice) : null;
        const yesterdayPrice = yesterdayRow
          ? num(yesterdayRow.weightedAvgPrice)
          : null;
        const weekStartPrice = weekStartRow
          ? num(weekStartRow.weightedAvgPrice)
          : null;

        const variation24h =
          todayPrice != null &&
          yesterdayPrice != null &&
          yesterdayPrice > 0
            ? ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100
            : num(todayRow?.variationPct ?? null);

        const variation7d =
          todayPrice != null && weekStartPrice != null && weekStartPrice > 0
            ? ((todayPrice - weekStartPrice) / weekStartPrice) * 100
            : null;

        return {
          category: cat,
          label: categoryLabelFr(cat),
          todayPrice,
          variation24h,
          variation7d,
          high30d: prices.length ? Math.max(...prices) : null,
          low30d: prices.length ? Math.min(...prices) : null,
          volume
        };
      }
    );

    const result = { rows: resultRows };
    await this.cache.set(cacheKey, result);
    return result;
  }

  private async ensureRangeCalculated(start: Date, end: Date): Promise<void> {
    let d = startOfUtcDay(start);
    const last = startOfUtcDay(end);
    while (d.getTime() <= last.getTime()) {
      const existing = await this.prisma.pigPriceIndexDaily.findFirst({
        where: { date: d },
        select: { id: true }
      });
      if (!existing) {
        try {
          await this.calculateForDate(d);
        } catch (e) {
          this.log.warn(`calculate ${d.toISOString()}: ${(e as Error).message}`);
        }
      }
      d = addUtcDays(d, 1);
    }
  }

  private aggregatePoints(
    rows: DailyRow[],
    period: PigPriceIndexPeriod
  ): PigPriceIndexPointDto[] {
    if (period === "7d" || period === "30d") {
      return rows.map((r) => this.rowToPoint(r));
    }
    if (period === "3m") {
      return this.bucketWeekly(rows);
    }
    return this.bucketMonthly(rows);
  }

  private rowToPoint(r: DailyRow): PigPriceIndexPointDto {
    const count = r.transactionCount;
    return {
      date: r.date.toISOString().slice(0, 10),
      avgPricePerKg: Number(r.weightedAvgPrice),
      listingAvgPrice: num(r.listingAvgPrice),
      transactionCount: count,
      variationPct: num(r.variationPct),
      limitedData: count < MIN_TRANSACTIONS_FOR_POINT
    };
  }

  private bucketWeekly(rows: DailyRow[]): PigPriceIndexPointDto[] {
    const buckets = new Map<string, DailyRow[]>();
    for (const r of rows) {
      const d = r.date;
      const day = d.getUTCDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = addUtcDays(d, mondayOffset);
      const key = monday.toISOString().slice(0, 10);
      const arr = buckets.get(key) ?? [];
      arr.push(r);
      buckets.set(key, arr);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, group]) => this.mergeRows(key, group));
  }

  private bucketMonthly(rows: DailyRow[]): PigPriceIndexPointDto[] {
    const buckets = new Map<string, DailyRow[]>();
    for (const r of rows) {
      const key = `${r.date.getUTCFullYear()}-${String(r.date.getUTCMonth() + 1).padStart(2, "0")}`;
      const arr = buckets.get(key) ?? [];
      arr.push(r);
      buckets.set(key, arr);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, group]) => this.mergeRows(`${key}-01`, group));
  }

  private mergeRows(dateKey: string, group: DailyRow[]): PigPriceIndexPointDto {
    let sumPrice = 0;
    let sumWeight = 0;
    let count = 0;
    let listingSum = 0;
    let listingCount = 0;
    for (const r of group) {
      const w = Number(r.weightedAvgPrice);
      const c = r.transactionCount;
      if (c > 0 && Number.isFinite(w)) {
        sumPrice += w * c;
        sumWeight += c;
        count += c;
      }
      if (r.listingAvgPrice != null && r.listingCount > 0) {
        listingSum += Number(r.listingAvgPrice) * r.listingCount;
        listingCount += r.listingCount;
      }
    }
    const avg = sumWeight > 0 ? sumPrice / sumWeight : 0;
    return {
      date: dateKey.slice(0, 10),
      avgPricePerKg: avg,
      listingAvgPrice: listingCount > 0 ? listingSum / listingCount : null,
      transactionCount: count,
      variationPct: null,
      limitedData: count < MIN_TRANSACTIONS_FOR_POINT
    };
  }
}
