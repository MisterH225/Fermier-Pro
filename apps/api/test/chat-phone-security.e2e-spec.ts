import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { maskPhoneNumbers } from "@fermier/phone";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());

const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describe("PhoneNumberDetector (unit)", () => {
  it("masque un numéro local", () => {
    const r = maskPhoneNumbers("Appelez au 0708123456");
    expect(r.wasModified).toBe(true);
    expect(r.maskedText).toBe("Appelez au ****");
  });

  it("ne masque pas les prix FCFA", () => {
    expect(maskPhoneNumbers("50000 FCFA").wasModified).toBe(false);
  });

  it("conserve prix et masque numéro", () => {
    const r = maskPhoneNumbers(
      "Le prix est 50000 FCFA et mon numéro est 0708123456"
    );
    expect(r.maskedText).toContain("50000 FCFA");
    expect(r.maskedText).toContain("****");
  });
});

describeOrSkip("Chat phone security (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("masque un numéro côté backend à l'envoi", async () => {
    const ensure = await request(app.getHttpServer())
      .post(`/api/v1/chat/rooms/farm/${ctx.farmId}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    const roomId = ensure.body?.id as string;

    const posted = await request(app.getHttpServer())
      .post(`/api/v1/chat/rooms/${roomId}/messages`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ body: "Mon tel 0708123456 merci" });

    expect(posted.status).toBeGreaterThanOrEqual(200);
    expect(posted.status).toBeLessThan(300);
    expect(posted.body?.body).toBe("Mon tel **** merci");
    expect(posted.body?.wasModified).toBe(true);
    expect(posted.body?.modificationType).toBe("phone_masked");
  });

  it("POST /chat/analyze-image bloque si Gemini indisponible", async () => {
    const prev = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const res = await request(app.getHttpServer())
      .post("/api/v1/chat/analyze-image")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        imageBase64: Buffer.from("fake-image").toString("base64"),
        mimeType: "image/jpeg"
      });

    if (prev) {
      process.env.GEMINI_API_KEY = prev;
    }

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body?.allowed).toBe(false);
  });
});
