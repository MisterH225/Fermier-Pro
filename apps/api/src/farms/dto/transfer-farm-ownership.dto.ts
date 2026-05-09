import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class TransferFarmOwnershipDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  newOwnerUserId!: string;
}
