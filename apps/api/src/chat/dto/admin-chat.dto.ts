import { ChatRoomKind } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class AdminListChatRoomsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsEnum(ChatRoomKind)
  kind?: ChatRoomKind;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class AdminDeleteChatRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
