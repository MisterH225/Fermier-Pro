import { Injectable } from "@nestjs/common";
import { RegionalStatsQueryDto } from "./dto/regional-stats-query.dto";
import {
  DEFAULT_REGIONAL_PRIVACY,
  type RegionalStatsPrivacy,
  StatsQueryService
} from "./stats-query.service";

/** Façade HTTP — délègue à StatsQueryService (source unique écran + rapports). */
@Injectable()
export class RegionStatsService {
  constructor(private readonly statsQuery: StatsQueryService) {}

  getDataAvailability() {
    return this.statsQuery.getDataAvailability();
  }

  getRegionalMortality(
    query: RegionalStatsQueryDto,
    privacy: RegionalStatsPrivacy = DEFAULT_REGIONAL_PRIVACY
  ) {
    return this.statsQuery.queryMortality(query, privacy);
  }

  getRegionalHerd(
    query: RegionalStatsQueryDto,
    privacy: RegionalStatsPrivacy = DEFAULT_REGIONAL_PRIVACY
  ) {
    return this.statsQuery.queryHerd(query, privacy);
  }

  getRegionalReproduction(
    query: RegionalStatsQueryDto,
    privacy: RegionalStatsPrivacy = DEFAULT_REGIONAL_PRIVACY
  ) {
    return this.statsQuery.queryReproduction(query, privacy);
  }

  getRegionalGrowth(
    query: RegionalStatsQueryDto,
    privacy: RegionalStatsPrivacy = DEFAULT_REGIONAL_PRIVACY
  ) {
    return this.statsQuery.queryGrowth(query, privacy);
  }

  getRegionalVetCoverage(
    query: RegionalStatsQueryDto,
    privacy: RegionalStatsPrivacy = DEFAULT_REGIONAL_PRIVACY
  ) {
    return this.statsQuery.queryVetCoverage(query, privacy);
  }

  getRegionalEconomy(
    query: RegionalStatsQueryDto,
    privacy: RegionalStatsPrivacy = DEFAULT_REGIONAL_PRIVACY
  ) {
    return this.statsQuery.queryEconomy(query, privacy);
  }

  getRegionalHealth(
    query: RegionalStatsQueryDto,
    privacy: RegionalStatsPrivacy = DEFAULT_REGIONAL_PRIVACY
  ) {
    return this.statsQuery.queryHealth(query, privacy);
  }

  getRegionalLifecycle(
    query: RegionalStatsQueryDto,
    privacy: RegionalStatsPrivacy = DEFAULT_REGIONAL_PRIVACY
  ) {
    return this.statsQuery.queryLifecycle(query, privacy);
  }

  getRegionalAdoption(
    query: RegionalStatsQueryDto,
    privacy: RegionalStatsPrivacy = DEFAULT_REGIONAL_PRIVACY
  ) {
    return this.statsQuery.queryAdoption(query, privacy);
  }
}
