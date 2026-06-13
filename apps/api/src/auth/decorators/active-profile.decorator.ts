import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Profile } from "@prisma/client";
import type { Request } from "express";

export type ActiveProfilePayload = Pick<
  Profile,
  "id" | "type" | "displayName" | "avatarUrl"
>;

export const ActiveProfile = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveProfilePayload => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const profile = req.activeProfile;
    if (!profile) {
      throw new Error("ActiveProfile decorator requires ActiveProfileGuard");
    }
    return {
      id: profile.id,
      type: profile.type,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl
    };
  }
);
