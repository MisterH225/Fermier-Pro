import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HealthEventsController } from "./health-events.controller";
import { HealthEventsService } from "./health-events.service";

@Module({
  imports: [AuthModule],
  controllers: [HealthEventsController],
  providers: [HealthEventsService]
})
export class HealthEventsModule {}
