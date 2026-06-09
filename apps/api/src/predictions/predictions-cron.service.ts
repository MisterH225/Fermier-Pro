import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PredictionsService } from "./predictions.service";

@Injectable()
export class PredictionsCronService {
  private readonly log = new Logger(PredictionsCronService.name);

  constructor(private readonly predictions: PredictionsService) {}

  /** Recalcul nocturne des prévisions (02:00 serveur). */
  @Cron("0 2 * * *")
  async nightlyPredictionsRefresh(): Promise<void> {
    this.log.log("Predictions nightly refresh — démarrage");
    await this.predictions.refreshAllActiveFarms();
    this.log.log("Predictions nightly refresh — terminé");
  }
}
