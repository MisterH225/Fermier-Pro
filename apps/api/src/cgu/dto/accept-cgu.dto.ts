import { IsString, MaxLength } from "class-validator";

export class AcceptCguDto {
  @IsString()
  @MaxLength(16)
  version!: string;
}
