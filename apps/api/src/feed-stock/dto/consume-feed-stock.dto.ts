import { Type } from "class-transformer";
import { IsNumber, Max, Min } from "class-validator";

export class ConsumeFeedStockDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(1e9)
  kg!: number;
}
