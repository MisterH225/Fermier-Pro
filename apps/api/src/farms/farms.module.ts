import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InvitationsModule } from "../invitations/invitations.module";
import { FarmsController } from "./farms.controller";
import { FarmsService } from "./farms.service";

@Module({
  imports: [AuthModule, InvitationsModule],
  controllers: [FarmsController],
  providers: [FarmsService]
})
export class FarmsModule {}
