import { IsOptional, IsString, IsUrl, Matches, MaxLength } from "class-validator";

export class CreateConsultationAttachmentDto {
  @IsUrl({ protocols: ["https"], require_protocol: true, require_tld: true })
  @Matches(
    /^https:\/\/[a-z0-9-]+\.supabase\.co\//,
    { message: "L'URL doit pointer vers le stockage Supabase (https://*.supabase.co/...)" }
  )
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
