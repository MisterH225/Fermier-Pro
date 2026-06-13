import type { NestExpressApplication } from "@nestjs/platform-express";
import { ChatRoomKind, PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  attachSuperAdminToUser,
  detachSuperAdmin
} from "./helpers/e2e-admin-seed";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Chat admin (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let superAdminId: string;
  let roomId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    const admin = await attachSuperAdminToUser(ctx.prisma, ctx.userId);
    superAdminId = admin.superAdminId;
    app = await createTestApp();

    const room = await ctx.prisma.chatRoom.create({
      data: {
        kind: ChatRoomKind.direct,
        directKey: `e2e_admin_chat_${ctx.userId}_${ctx.peerUserId}`,
        title: "Salon test admin e2e",
        members: {
          create: [{ userId: ctx.userId }, { userId: ctx.peerUserId }]
        },
        messages: {
          create: {
            senderUserId: ctx.userId,
            body: "Message test suppression admin"
          }
        }
      }
    });
    roomId = room.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await ctx.prisma.chatMessage.deleteMany({ where: { roomId } });
      await ctx.prisma.chatRoomMember.deleteMany({ where: { roomId } });
      await ctx.prisma.chatRoom.deleteMany({ where: { id: roomId } });
      if (superAdminId) {
        await detachSuperAdmin(ctx.prisma, superAdminId);
      }
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("GET /admin/chat/rooms liste les salons", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/chat/rooms")
      .set("Authorization", `Bearer ${ctx.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.items)).toBe(true);
    expect(res.body.items.some((r: { id: string }) => r.id === roomId)).toBe(true);
  });

  it("DELETE /admin/chat/rooms/:id supprime un salon", async () => {
    const delRes = await request(app.getHttpServer())
      .delete(`/api/v1/admin/chat/rooms/${roomId}`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ reason: "e2e test" });

    expect(delRes.status).toBe(200);
    expect(delRes.body?.ok).toBe(true);

    const listRes = await request(app.getHttpServer())
      .get("/api/v1/admin/chat/rooms")
      .set("Authorization", `Bearer ${ctx.token}`);

    expect(
      (listRes.body.items as Array<{ id: string }>).some((r) => r.id === roomId)
    ).toBe(false);
  });
});
