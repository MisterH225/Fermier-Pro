import {
  CommunityFeedPostType,
  FeedUserStatus,
  ProfileType
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class CreateFeedPostDto {
  @IsEnum(CommunityFeedPostType)
  postType!: CommunityFeedPostType;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorRegion?: string;
}

export class CreateFeedCommentDto {
  @IsString()
  postId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorRegion?: string;
}

export class PreModerateContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsEnum(CommunityFeedPostType)
  postType?: CommunityFeedPostType;
}

export class PostSendModerateDto {
  @IsString()
  postId!: string;
}

export class CreateSanctionAppealDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  appealMessage!: string;
}

export class AdminFeedSanctionDto {
  @IsEnum(FeedUserStatus)
  feedStatus!: FeedUserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ListFeedPostsQueryDto {
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
}

export const FEED_POST_TYPES_BY_PROFILE: Record<
  ProfileType,
  CommunityFeedPostType[]
> = {
  producer: [
    CommunityFeedPostType.question,
    CommunityFeedPostType.tip,
    CommunityFeedPostType.observation,
    CommunityFeedPostType.alert,
    CommunityFeedPostType.success
  ],
  veterinarian: [
    CommunityFeedPostType.question,
    CommunityFeedPostType.tip,
    CommunityFeedPostType.observation,
    CommunityFeedPostType.alert,
    CommunityFeedPostType.success,
    CommunityFeedPostType.medical_tip
  ],
  technician: [
    CommunityFeedPostType.question,
    CommunityFeedPostType.tip,
    CommunityFeedPostType.observation,
    CommunityFeedPostType.success,
    CommunityFeedPostType.technical_tip
  ],
  buyer: [
    CommunityFeedPostType.question,
    CommunityFeedPostType.observation,
    CommunityFeedPostType.success
  ]
};
