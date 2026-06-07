import { IsString, MaxLength, MinLength } from "class-validator";

export class AnalyzeChatImageDto {
  @IsString()
  @MinLength(16)
  @MaxLength(8_000_000)
  imageBase64!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(64)
  mimeType!: string;
}
