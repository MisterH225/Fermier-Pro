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
    if (!devices.length) {
      return false;
    }
    const messages: ExpoPushMessage[] = devices
      .filter((d) => d.token?.startsWith("ExponentPushToken"))
      .map((d) => ({
        to: d.token,
        title,
        body,
        data
      }));
    if (!messages.length) {
      return false;
    }
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(messages.length === 1 ? messages[0] : messages)
      });
      if (!res.ok) {
        this.logger.warn(
          `Expo push HTTP ${res.status} pour user ${userId}: ${await res.text()}`
        );
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`Expo push echoue pour user ${userId}`, e);
      return false;
    }
  }
}
