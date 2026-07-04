import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DistributedLockService } from "../common/distributed-lock.service";
import { PredictionsService } from "./predictions.service";

@Injectable()
export class PredictionsCronService {
  private readonly log = new Logger(PredictionsCronService.name);

  constructor(
    private readonly predictions: PredictionsService,
    private readonly locks: DistributedLockService
  ) {}

  /** Recalcul nocturne des prévisions (02:00 serveur). */
  @Cron("0 2 * * *")
  async nightlyPredictionsRefresh(): Promise<void> {
    await this.locks.withLock("cron:predictions-nightly", async () => {
      this.log.log("Predictions nightly refresh — démarrage");
      await this.predictions.refreshAllActiveFarms();
      this.log.log("Predictions nightly refresh — terminé");
    });
  }
}
