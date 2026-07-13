import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { ConsoleAccessGuard } from "../admin-platform/console-access.guard";
import { AdminConsoleMenuGuard } from "../admin-platform/admin-console-menu.guard";
import { ChatAdminService } from "./chat-admin.service";
import {
  AdminDeleteChatRoomDto,
  AdminListChatRoomsQueryDto
} from "./dto/admin-chat.dto";

@Controller("admin/chat")
@UseGuards(SupabaseJwtGuard, ConsoleAccessGuard, AdminConsoleMenuGuard)
export class ChatAdminController {
  constructor(private readonly chatAdmin: ChatAdminService) {}

  @Get("rooms")
  listRooms(@Query() query: AdminListChatRoomsQueryDto) {
    return this.chatAdmin.listRooms(
      query.page ?? 1,
      query.limit ?? 20,
      query.kind,
      query.userId
    );
  }

  @Get("rooms/:id/messages")
  listMessages(
    @Param("id") roomId: string,
    @Query("limit") limit?: string
  ) {
    const n = Number(limit);
    return this.chatAdmin.listRoomMessages(
      roomId,
      Number.isFinite(n) && n > 0 ? n : 50
    );
  }

  @Delete("rooms/:id")
  deleteRoom(@Param("id") roomId: string, @Body() body: AdminDeleteChatRoomDto) {
    return this.chatAdmin.deleteRoom(roomId, body.reason);
  }
}
