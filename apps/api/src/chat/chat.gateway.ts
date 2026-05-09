import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";
import { ChatService } from "./chat.service";
import { WsJoinRoomDto } from "./dto/ws-join-room.dto";
import { WsSendMessageDto } from "./dto/ws-send-message.dto";

@WebSocketGateway({
  namespace: "/chat",
  cors: { origin: "*" }
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly chat: ChatService
  ) {}

  broadcastNewMessage(roomId: string, message: unknown) {
    this.server?.to(this.roomChannel(roomId)).emit("newMessage", message);
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const user = await this.auth.userFromAccessToken(token);
      client.data.userId = user.id;
    } catch (err) {
      this.logger.debug(`WS chat refus: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  private extractToken(client: Socket): string | null {
    const a = client.handshake.auth;
    if (a && typeof a === "object" && typeof a.token === "string") {
      return a.token.trim();
    }
    const h = client.handshake.headers.authorization;
    if (typeof h === "string" && h.startsWith("Bearer ")) {
      return h.slice("Bearer ".length).trim();
    }
    return null;
  }

  private roomChannel(roomId: string) {
    return `room:${roomId}`;
  }

  @SubscribeMessage("joinRoom")
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WsJoinRoomDto
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return { ok: false, error: "unauthorized" };
    }
    await this.chat.assertRoomMember(userId, body.roomId);
    await client.join(this.roomChannel(body.roomId));
    return { ok: true, roomId: body.roomId };
  }

  @SubscribeMessage("leaveRoom")
  async leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WsJoinRoomDto
  ) {
    await client.leave(this.roomChannel(body.roomId));
    return { ok: true };
  }

  @SubscribeMessage("sendMessage")
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WsSendMessageDto
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return { ok: false, error: "unauthorized" };
    }
    const msg = await this.chat.createMessage(userId, body.roomId, body.body);
    this.server.to(this.roomChannel(body.roomId)).emit("newMessage", msg);
    return msg;
  }
}
