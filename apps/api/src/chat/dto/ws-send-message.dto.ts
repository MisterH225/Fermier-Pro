import { IsString, MaxLength, MinLength } from "class-validator";

export class WsSendMessageDto {
  @IsString()
  roomId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;
}
