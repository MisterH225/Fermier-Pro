import {
  CanActivate,
  ExecutionContext,
  Injectable
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth.service";

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.auth.extractBearerToken(
      req.headers.authorization as string | undefined
    );
    const payload = this.auth.verifySupabaseAccessToken(token);
    const user = await this.auth.syncUserFromSupabasePayload(payload);
    req.user = user;
    return true;
  }
}
