import { Module, forwardRef } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { AuthModule } from "../auth/auth.module";
import { ChatModule } from "../chat/chat.module";
import { CommonModule } from "../common/common.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { FeedIngredientsModule } from "../feed-ingredients/feed-ingredients.module";
import { MobileMoneyModule } from "../marketplace/escrow";
import { MarketplaceModule } from "../marketplace/marketplace.module";
import { PrismaModule } from "../prisma/prisma.module";
import { UserNotificationsModule } from "../user-notifications/user-notifications.module";
import { WalletModule } from "../wallet/wallet.module";
import { AdminFeedRequirementProfilesController } from "./admin-feed-requirement-profiles.controller";
import { CompositionPricingService } from "./assist/composition-pricing.service";
import { FeedCompositionAssistService } from "./assist/feed-composition-assist.service";
import { FeedCompositionController } from "./assist/feed-composition.controller";
import { FeedCompositionExplainService } from "./assist/explain/feed-composition-explain.service";
import { IngredientAvailabilityService } from "./assist/ingredient-availability.service";
import { SavedCompositionsService } from "./assist/saved-compositions.service";
import { CompositionOrdersController } from "./composition-orders/composition-orders.controller";
import { CompositionOrdersService } from "./composition-orders/composition-orders.service";
import { FeedFormulationService } from "./feed-formulation.service";
import { FeedRequirementProfilesService } from "./feed-requirement-profiles.service";
import { JavascriptLpSolver } from "./solver/javascript-lp.solver";
import { SOLVER_PORT } from "./solver/solver.port";

/**
 * Module « Composition d'aliments » (flag feed_composition).
 * - CRUD superadmin profils de besoins
 * - Moteur de formulation (interne)
 * - Agent Gemini + mode dégradé + SavedComposition (J3)
 */
@Module({
  imports: [
    PrismaModule,
    CommonModule,
    forwardRef(() => AuthModule),
    FeatureFlagsModule,
    FeedIngredientsModule,
    UserNotificationsModule,
    AiModule,
    forwardRef(() => ChatModule),
    WalletModule,
    MobileMoneyModule,
    forwardRef(() => MarketplaceModule)
  ],
  controllers: [
    AdminFeedRequirementProfilesController,
    FeedCompositionController,
    CompositionOrdersController
  ],
  providers: [
    FeedRequirementProfilesService,
    FeedFormulationService,
    JavascriptLpSolver,
    { provide: SOLVER_PORT, useExisting: JavascriptLpSolver },
    SuperAdminGuard,
    IngredientAvailabilityService,
    FeedCompositionAssistService,
    FeedCompositionExplainService,
    SavedCompositionsService,
    CompositionPricingService,
    CompositionOrdersService
  ],
  exports: [
    FeedFormulationService,
    FeedRequirementProfilesService,
    FeedCompositionAssistService,
    FeedCompositionExplainService,
    SavedCompositionsService,
    CompositionPricingService,
    CompositionOrdersService
  ]
})
export class FeedFormulationModule {}
