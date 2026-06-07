import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationsEnabled: true }
    });
    if (!user?.notificationsEnabled) {
      return false;
    }
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId }
    });
    return this.sendExpoMessages(
      devices
        .filter((d) => d.token?.startsWith("ExponentPushToken"))
        .map((d) => ({ to: d.token, title, body, data }))
    );
  }

  /** Diffusion push vers utilisateurs actifs (alertes sanitaires plateforme). */
  async broadcast(
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<number> {
    const devices = await this.prisma.pushDevice.findMany({
      where: {
        user: { isActive: true, notificationsEnabled: true }
      },
      select: { token: true }
    });
    const messages: ExpoPushMessage[] = devices
      .filter((d) => d.token?.startsWith("ExponentPushToken"))
      .map((d) => ({ to: d.token, title, body, data }));
    if (!messages.length) {
      return 0;
    }
    const sent = await this.sendExpoMessages(messages);
    return sent ? messages.length : 0;
  }

  private async sendExpoMessages(messages: ExpoPushMessage[]): Promise<boolean> {
    if (!messages.length) {
      return false;
    }
    try {
      const chunks: ExpoPushMessage[][] = [];
      for (let i = 0; i < messages.length; i += 100) {
        chunks.push(messages.slice(i, i + 100));
      }
      for (const chunk of chunks) {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(chunk.length === 1 ? chunk[0] : chunk)
        });
        if (!res.ok) {
          this.logger.warn(
            `Expo push batch HTTP ${res.status}: ${await res.text()}`
          );
          return false;
        }
      }
      return true;
    } catch (e) {
      this.logger.warn("Expo push batch echoue", e);
      return false;
    }
  }
}
