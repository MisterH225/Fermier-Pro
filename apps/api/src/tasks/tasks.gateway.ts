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
import { FarmAccessService } from "../common/farm-access.service";
import { FeatureFlagService } from "../config-client/feature-flags.service";
import { WsJoinFarmDto } from "./dto/ws-join-farm.dto";

@WebSocketGateway({
  namespace: "/tasks",
  cors: { origin: "*" }
})
export class TasksGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TasksGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly farmAccess: FarmAccessService,
    private readonly featureFlags: FeatureFlagService
  ) {}

  farmChannel(farmId: string) {
    return `farm:${farmId}`;
  }

  broadcastTaskChange(farmId: string, payload: unknown) {
    this.server?.to(this.farmChannel(farmId)).emit("taskChanged", payload);
  }

  async handleConnection(client: Socket) {
    if (!this.featureFlags.isEnabled("tasks")) {
      client.disconnect(true);
      return;
    }
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const user = await this.auth.userFromAccessToken(token);
      client.data.userId = user.id;
    } catch (err) {
      this.logger.debug(`WS tasks refus: ${(err as Error).message}`);
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

  @SubscribeMessage("joinFarm")
  async joinFarm(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WsJoinFarmDto
  ) {
    if (!this.featureFlags.isEnabled("tasks")) {
      return { ok: false, error: "module_disabled" };
    }
    const userId = client.data.userId as string | undefined;
    if (!userId || !body?.farmId) {
      return { ok: false, error: "unauthorized" };
    }
    try {
      await this.farmAccess.requireFarmAccess(userId, body.farmId);
      await client.join(this.farmChannel(body.farmId));
      return { ok: true };
    } catch {
      return { ok: false, error: "forbidden" };
    }
  }
}
