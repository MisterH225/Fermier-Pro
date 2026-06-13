import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { CommunityFeedController } from "./community-feed.controller";
import { CommunityFeedAdminController } from "./community-feed-admin.controller";
import { CommunityFeedService } from "./community-feed.service";
import { FeedModerationAgentService } from "./services/feed-moderation-agent.service";
import { SanctionService } from "./services/sanction.service";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [CommunityFeedController, CommunityFeedAdminController],
  providers: [
    CommunityFeedService,
    FeedModerationAgentService,
    SanctionService,
    SuperAdminGuard
  ],
  exports: [CommunityFeedService, SanctionService]
})
export class CommunityFeedModule {}
