import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class ListOrdersQueryDto {
  @IsIn(["buyer", "seller"])
  role!: "buyer" | "seller";

  @IsIn(["action_required", "active", "closed", "disputed"])
  segment!: "action_required" | "active" | "closed" | "disputed";

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class OrdersCountersQueryDto {
  @IsIn(["buyer", "seller"])
  role!: "buyer" | "seller";
}
