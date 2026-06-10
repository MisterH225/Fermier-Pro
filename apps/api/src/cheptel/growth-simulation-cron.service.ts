import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { GrowthSimulationService } from "./growth-simulation.service";

@Injectable()
export class GrowthSimulationCronService {
  private readonly log = new Logger(GrowthSimulationCronService.name);

  constructor(private readonly growth: GrowthSimulationService) {}

  /** Simulation hebdomadaire — lundi 04:00 (après alertes 03:00). */
  @Cron("0 4 * * 1")
  async weeklyGrowthSimulation(): Promise<void> {
    this.log.log("Weekly growth simulation — all farms");
    await this.growth.runForAllFarms();
  }
}
