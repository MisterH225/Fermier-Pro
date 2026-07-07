import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { ChatGateway } from "./chat.gateway";
import { ChatPhoneSecurityService } from "./chat-phone-security.service";
import { ChatService } from "./chat.service";
import { AnalyzeChatImageDto } from "./dto/analyze-chat-image.dto";
import { CreateDirectChatDto } from "./dto/create-direct-chat.dto";
import { SendChatMessageDto } from "./dto/send-chat-message.dto";
import { ImageAnalysisService } from "./image-analysis.service";

@Controller("chat")
@RequireFeature("chat")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
    private readonly imageAnalysis: ImageAnalysisService,
    private readonly phoneSecurity: ChatPhoneSecurityService
  ) {}

  @Get("rooms")
  listRooms(@CurrentUser() user: User) {
    return this.chat.listRooms(user);
  }

  /** Recherche d’utilisateurs pour conversation directe (nom ou e-mail). */
  @Get("directory/users")
  searchUsersForChat(
    @CurrentUser() user: User,
    @Query("q") q?: string
  ) {
    return this.chat.searchUsersForChat(user, q ?? "");
  }

  @Post("rooms/farm/:farmId")
  @UseGuards(FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.chat)
  ensureFarmRoom(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.chat.ensureFarmRoom(user, farmId);
  }

  @Post("rooms/direct")
  ensureDirectRoom(
    @CurrentUser() user: User,
    @Body() dto: CreateDirectChatDto
  ) {
    return this.chat.ensureDirectRoom(
      user,
      dto.peerUserId,
      dto.marketplaceListingId?.trim() || undefined,
      dto.merchantProductId?.trim() || undefined
    );
  }

  @Get("rooms/:roomId")
  getRoom(@CurrentUser() user: User, @Param("roomId") roomId: string) {
    return this.chat.getRoom(user, roomId);
  }

  @Post("rooms/:roomId/read")
  markRoomRead(@CurrentUser() user: User, @Param("roomId") roomId: string) {
    return this.chat.markRoomRead(user, roomId);
  }

  @Get("rooms/:roomId/messages")
  listMessages(
    @CurrentUser() user: User,
    @Param("roomId") roomId: string,
    @Query("cursor") cursor?: string,
    @Query("take") takeRaw?: string
  ) {
    const take = (() => {
      if (takeRaw === undefined || takeRaw === "") {
        return 50;
      }
      const n = Number.parseInt(takeRaw, 10);
      return Number.isFinite(n) ? n : 50;
    })();
    return this.chat.listMessages(user, roomId, cursor, take);
  }

  @Post("rooms/:roomId/messages")
  async postMessage(
    @CurrentUser() user: User,
    @Param("roomId") roomId: string,
    @Body() dto: SendChatMessageDto
  ) {
    const msg = await this.chat.createMessage(user.id, roomId, dto.body);
    this.chat.notifyPeersOfNewMessage(user.id, roomId, msg.body);
    this.gateway.broadcastNewMessage(roomId, msg);
    return msg;
  }

  @Post("analyze-image")
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 analyses/min max pour éviter abus Gemini et DoS
  async analyzeImage(
    @CurrentUser() user: User,
    @Body() dto: AnalyzeChatImageDto
  ) {
    const result = await this.imageAnalysis.analyzeImageBase64(
      dto.imageBase64,
      dto.mimeType
    );
    if (!result.allowed) {
      await this.phoneSecurity.logImageBlocked(user.id, null, {
        reason: result.reason
      });
      return { allowed: false, reason: result.reason ?? "phone_number_detected" };
    }
    return { allowed: true };
  }
}
