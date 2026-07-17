import { Injectable } from "@nestjs/common";
import { RegionalStatsQueryDto } from "./dto/regional-stats-query.dto";
import { StatsQueryService } from "./stats-query.service";

/** Façade HTTP — délègue à StatsQueryService (source unique écran + rapports). */
@Injectable()
export class RegionStatsService {
  constructor(private readonly statsQuery: StatsQueryService) {}

  getRegionalMortality(query: RegionalStatsQueryDto) {
    return this.statsQuery.queryMortality(query);
  }

  getRegionalHerd(query: RegionalStatsQueryDto) {
    return this.statsQuery.queryHerd(query);
  }

  getRegionalReproduction(query: RegionalStatsQueryDto) {
    return this.statsQuery.queryReproduction(query);
  }

  getRegionalGrowth(query: RegionalStatsQueryDto) {
    return this.statsQuery.queryGrowth(query);
  }

  getRegionalVetCoverage(query: RegionalStatsQueryDto) {
    return this.statsQuery.queryVetCoverage(query);
  }

  getRegionalEconomy(query: RegionalStatsQueryDto) {
    return this.statsQuery.queryEconomy(query);
  }
}
