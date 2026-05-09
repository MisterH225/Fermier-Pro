import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FarmMembersController } from "./farm-members.controller";
import { FarmMembersService } from "./farm-members.service";

@Module({
  imports: [AuthModule],
  controllers: [FarmMembersController],
  providers: [FarmMembersService]
})
export class FarmMembersModule {}
