import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { FeedStockController } from "./feed-stock.controller";
import { FeedStockService } from "./feed-stock.service";

@Module({
  imports: [AuthModule, ConfigClientModule],
  controllers: [FeedStockController],
  providers: [FeedStockService]
})
export class FeedStockModule {}
