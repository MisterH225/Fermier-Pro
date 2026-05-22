import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CguController } from "./cgu.controller";
import { CguService } from "./cgu.service";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [CguController],
  providers: [CguService],
  exports: [CguService]
})
export class CguModule {}
