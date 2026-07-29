import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class AdminDeleteRatingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
