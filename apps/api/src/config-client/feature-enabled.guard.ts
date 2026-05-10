import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  type ClientFeatureKey,
  FeatureFlagService
} from "./feature-flags.service";
import { FEATURE_FLAG_METADATA } from "./require-feature.decorator";

@Injectable()
export class FeatureEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlagService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const key = this.reflector.getAllAndOverride<ClientFeatureKey>(
      FEATURE_FLAG_METADATA,
      [context.getHandler(), context.getClass()]
    );
    if (!key) {
      return true;
    }
    if (!this.flags.isEnabled(key)) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        message: `Fonctionnalite desactivee (${key})`,
        error: "Service Unavailable"
      });
    }
    return true;
  }
}
