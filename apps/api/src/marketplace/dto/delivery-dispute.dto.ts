import { IsArray, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class DeliveryDisputeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  disputeType!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}
