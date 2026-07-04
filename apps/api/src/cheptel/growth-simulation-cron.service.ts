import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DistributedLockService } from "../common/distributed-lock.service";
import { GrowthSimulationService } from "./growth-simulation.service";

@Injectable()
export class GrowthSimulationCronService {
  private readonly log = new Logger(GrowthSimulationCronService.name);

  constructor(
    private readonly growth: GrowthSimulationService,
    private readonly locks: DistributedLockService
  ) {}

  /** Simulation hebdomadaire — lundi 04:00 (après alertes 03:00). */
  @Cron("0 4 * * 1")
  async weeklyGrowthSimulation(): Promise<void> {
    await this.locks.withLock("cron:growth-simulation-weekly", async () => {
      this.log.log("Weekly growth simulation — all farms");
      await this.growth.runForAllFarms();
    });
  }
}
