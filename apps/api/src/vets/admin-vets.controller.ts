import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RejectVetProfileDto } from "./dto/reject-vet-profile.dto";
import { VetsService } from "./vets.service";

@Controller("admin/vet-profiles")
export class AdminVetsController {
  constructor(
    private readonly vets: VetsService,
    private readonly config: ConfigService
  ) {}

  private assertSecret(secret: string | undefined) {
    const expected = this.config
      .get<string>("VET_VERIFICATION_SECRET")
      ?.trim();
    if (!expected || secret?.trim() !== expected) {
      throw new UnauthorizedException("Secret admin invalide");
    }
  }

  @Post(":id/verify")
  verify(
    @Headers("x-vet-verification-secret") secret: string | undefined,
    @Param("id") id: string
  ) {
    this.assertSecret(secret);
    return this.vets.verifyProfile(id);
  }

  @Post(":id/reject")
  reject(
    @Headers("x-vet-verification-secret") secret: string | undefined,
    @Param("id") id: string,
    @Body() dto: RejectVetProfileDto
  ) {
    this.assertSecret(secret);
    return this.vets.rejectProfile(id, dto.reason);
  }
}
