import { MembershipRole } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString
} from "class-validator";

export class UpdateFarmMemberDto {
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  scopes?: string[];
}
