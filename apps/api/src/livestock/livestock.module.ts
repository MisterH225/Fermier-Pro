import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BatchesController } from "./batches.controller";
import { BatchesService } from "./batches.service";
import { LivestockController } from "./livestock.controller";
import { LivestockService } from "./livestock.service";
import { TaxonomyController } from "./taxonomy.controller";
import { TaxonomyService } from "./taxonomy.service";

@Module({
  imports: [AuthModule],
  controllers: [LivestockController, BatchesController, TaxonomyController],
  providers: [LivestockService, BatchesService, TaxonomyService]
})
export class LivestockModule {}
