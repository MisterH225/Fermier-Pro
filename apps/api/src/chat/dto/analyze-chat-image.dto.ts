import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

// ~500 Ko en base64 (ratio ~1.37 : 500_000 * 1.37 ≈ 685_000)
const MAX_IMAGE_B64 = 685_000;

export class AnalyzeChatImageDto {
  @IsString()
  @MinLength(16)
  @MaxLength(MAX_IMAGE_B64)
  imageBase64!: string;

  @IsString()
  @IsIn(["image/jpeg", "image/png", "image/webp", "image/gif"])
  mimeType!: string;
}
