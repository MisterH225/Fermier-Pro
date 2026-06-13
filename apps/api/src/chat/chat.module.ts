import { Module, forwardRef } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { ChatController } from "./chat.controller";
import { ChatAdminController } from "./chat-admin.controller";
import { ChatAdminService } from "./chat-admin.service";
import { ChatGateway } from "./chat.gateway";
import { ChatPhoneSecurityService } from "./chat-phone-security.service";
import { ChatService } from "./chat.service";
import { ImageAnalysisService } from "./image-analysis.service";

@Module({
  imports: [
    forwardRef(() => AuthModule),
    ConfigClientModule,
    AiModule,
    PushNotificationsModule
  ],
  controllers: [ChatController, ChatAdminController],
  providers: [
    ChatService,
    ChatAdminService,
    ChatGateway,
    ChatPhoneSecurityService,
    ImageAnalysisService
  ],
  exports: [ChatService]
})
export class ChatModule {}
