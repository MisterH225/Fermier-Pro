import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMinSize
} from "class-validator";
import { AdminMessageType } from "@prisma/client";

export enum ModerationScopeDto {
  account = "account",
  veterinarian = "veterinarian",
  producer = "producer",
  technician = "technician",
  buyer = "buyer"
}

export class SuspendUserDto {
  @IsEnum(ModerationScopeDto)
  scope!: ModerationScopeDto;

  @IsString()
  @MaxLength(200)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;

  @IsString()
  @MaxLength(64)
  duration!: string;

  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;
}

export class UnsuspendUserDto {
  @IsEnum(ModerationScopeDto)
  scope!: ModerationScopeDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;
}

export class BanUserDto {
  @IsEnum(ModerationScopeDto)
  scope!: ModerationScopeDto;

  @IsString()
  @MaxLength(200)
  reason!: string;

  @IsString()
  @MaxLength(2000)
  details!: string;

  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;
}

export class UnbanUserDto {
  @IsEnum(ModerationScopeDto)
  scope!: ModerationScopeDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;
}

export class DeleteProfileAdminDto {
  @IsString()
  @MaxLength(200)
  reason!: string;

  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;
}

export class DeleteAccountAdminDto {
  @IsString()
  @MaxLength(200)
  reason!: string;

  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;
}

export class WarnUserDto {
  @IsString()
  @MaxLength(200)
  motive!: string;

  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsString()
  @MaxLength(64)
  warningLevel!: string;

  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;
}

export class SendAdminMessageDto {
  @IsString()
  @MaxLength(200)
  subject!: string;

  @IsEnum(AdminMessageType)
  type!: AdminMessageType;

  @IsString()
  @MaxLength(8000)
  message!: string;

  @IsOptional()
  @IsBoolean()
  sendPush?: boolean;
}

export class SendAdminMessageToUserDto extends SendAdminMessageDto {
  /** Identifiant interne `User.id` (cuid Prisma), pas le sub Supabase. */
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class BulkAdminMessageDto extends SendAdminMessageDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  userIds!: string[];
}
