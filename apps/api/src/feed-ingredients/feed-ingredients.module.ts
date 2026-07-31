import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminFeedIngredientsController } from "./admin-feed-ingredients.controller";
import { FeedIngredientsService } from "./feed-ingredients.service";

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [AdminFeedIngredientsController],
  providers: [FeedIngredientsService, SuperAdminGuard],
  exports: [FeedIngredientsService]
})
export class FeedIngredientsModule {}
