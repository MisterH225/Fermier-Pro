import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateFeedMovementDto } from "./dto/create-feed-movement.dto";
import { CreateFeedTypeDto } from "./dto/create-feed-type.dto";
import { ListFeedMovementsQueryDto } from "./dto/list-feed-movements-query.dto";
import {
  ReconcileFeedMovementDto,
  RejectReconciliationDto
} from "./dto/reconcile-feed.dto";
import { UpdateFeedMovementDto } from "./dto/update-feed-movement.dto";
import { FarmFeedService } from "./farm-feed.service";
import { FeedFinanceLinkService } from "../feed-finance-link/feed-finance-link.service";
import { CreateMovementWithTransactionDto } from "../feed-finance-link/dto/feed-finance-link.dto";
import { ReconciliationEngine } from "../feed-finance-link/reconciliation-engine";

@Controller("farms/:farmId/feed")
@RequireFeature("feedStock")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class FarmFeedController {
  constructor(
    private readonly farmFeed: FarmFeedService,
    private readonly feedFinanceLink: FeedFinanceLinkService,
    private readonly reconciliation: ReconciliationEngine
  ) {}

  @Get("types")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  listTypes(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.farmFeed.listTypes(user, farmId);
  }

  @Post("types")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  createType(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateFeedTypeDto
  ) {
    return this.farmFeed.createType(user, farmId, dto);
  }

  @Get("overview")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  overview(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.farmFeed.overview(user, farmId);
  }

  @Get("chart")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  chart(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("period") period?: string
  ) {
    return this.farmFeed.chart(user, farmId, period);
  }

  @Get("stats")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  stats(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.farmFeed.stats(user, farmId);
  }

  @Get("movements")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  movements(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query() q: ListFeedMovementsQueryDto
  ) {
    return this.farmFeed.listMovements(user, farmId, q);
  }

  @Post("movements")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  createMovement(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateFeedMovementDto
  ) {
    return this.farmFeed.createMovement(user, farmId, dto);
  }

  @Post("movements/with-transaction")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  createMovementWithTransaction(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateMovementWithTransactionDto
  ) {
    return this.feedFinanceLink.createMovementWithTransaction(user, farmId, dto);
  }

  @Get("movements/incomplete")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  listIncompleteMovements(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.farmFeed.listIncompleteMovements(user, farmId);
  }

  @Patch("movements/:movementId")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  updateMovement(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("movementId") movementId: string,
    @Body() dto: UpdateFeedMovementDto
  ) {
    return this.farmFeed.updateMovement(user, farmId, movementId, dto);
  }

  @Delete("movements/:movementId")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  deleteMovement(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("movementId") movementId: string
  ) {
    return this.farmFeed.deleteMovement(user, farmId, movementId);
  }

  @Get("movements/:movementId/reconciliation-candidates")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  reconciliationCandidates(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("movementId") movementId: string
  ) {
    void user;
    void farmId;
    return this.reconciliation.buildOfferForMovement(movementId);
  }

  @Post("movements/:movementId/reconcile")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  reconcileMovement(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("movementId") movementId: string,
    @Body() dto: ReconcileFeedMovementDto
  ) {
    return this.reconciliation.mergeStockAndFinance(
      user,
      farmId,
      movementId,
      dto.expenseId
    );
  }

  @Post("movements/:movementId/reject-reconciliation")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  rejectReconciliation(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("movementId") movementId: string,
    @Body() dto: RejectReconciliationDto
  ) {
    return this.reconciliation
      .rejectReconciliation(user, farmId, movementId, dto.expenseId)
      .then(async () => {
        if (dto.totalCost != null && dto.totalCost > 0) {
          const expense = await this.reconciliation.addCostFromFollowUp(
            user,
            farmId,
            movementId,
            dto.totalCost,
            dto.supplier
          );
          return {
            ok: true,
            expenseId: expense.id,
            amount: expense.amount.toString()
          };
        }
        await this.reconciliation.flagCostMissing(movementId);
        return { ok: true };
      });
  }

  @Post("movements/:movementId/dismiss-reconciliation")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  dismissReconciliation(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("movementId") movementId: string
  ) {
    void user;
    void farmId;
    return this.reconciliation.dismissTemporarily(movementId).then(() => ({
      ok: true
    }));
  }

  @Post("movements/scan-reconciliation")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  scanReconciliation(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    void user;
    return this.reconciliation
      .scanUnlinkedMovements(farmId)
      .then((flagged) => ({ flagged }));
  }

  @Get("movements/:movementId/linked-transaction")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  getLinkedTransactionForMovement(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("movementId") movementId: string
  ) {
    return this.feedFinanceLink.getLinkedTransactionForMovement(
      user,
      farmId,
      movementId
    );
  }
}
