import { Module, forwardRef } from "@nestjs/common";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { AuthModule } from "../auth/auth.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { FeedIngredientsModule } from "../feed-ingredients/feed-ingredients.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminFeedRequirementProfilesController } from "./admin-feed-requirement-profiles.controller";
import { FeedFormulationService } from "./feed-formulation.service";
import { FeedRequirementProfilesService } from "./feed-requirement-profiles.service";
import { JavascriptLpSolver } from "./solver/javascript-lp.solver";
import { SOLVER_PORT } from "./solver/solver.port";

/**
 * Module interne « Composition d'aliments » (flag feed_composition).
 * - CRUD superadmin des profils de besoins
 * - Moteur de formulation au moindre coût (aucun endpoint mobile)
 */
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    FeatureFlagsModule,
    FeedIngredientsModule
  ],
  controllers: [AdminFeedRequirementProfilesController],
  providers: [
    FeedRequirementProfilesService,
    FeedFormulationService,
    JavascriptLpSolver,
    { provide: SOLVER_PORT, useExisting: JavascriptLpSolver },
    SuperAdminGuard
  ],
  exports: [FeedFormulationService, FeedRequirementProfilesService]
})
export class FeedFormulationModule {}
