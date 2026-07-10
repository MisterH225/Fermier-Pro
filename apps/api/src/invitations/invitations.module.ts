import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatModule } from "../chat/chat.module";
import { ProducerSubscriptionModule } from "../producer-subscription/producer-subscription.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { InvitationsController } from "./invitations.controller";
import { InvitationsService } from "./invitations.service";

@Module({
  imports: [
    AuthModule,
    ChatModule,
    PushNotificationsModule,
    ProducerSubscriptionModule
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService]
})
export class InvitationsModule {}
