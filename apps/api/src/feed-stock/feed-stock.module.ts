import { Module } from "@nestjs/common";
import { FeedStockController } from "./feed-stock.controller";
import { FeedStockService } from "./feed-stock.service";

@Module({
  controllers: [FeedStockController],
  providers: [FeedStockService]
})
export class FeedStockModule {}
