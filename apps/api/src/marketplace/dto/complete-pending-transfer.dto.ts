import { IsOptional, IsString } from "class-validator";

export class CompletePendingTransferDto {
  @IsOptional()
  @IsString()
  buyerFarmId?: string;

  @IsOptional()
  @IsString()
  penId?: string;
}
