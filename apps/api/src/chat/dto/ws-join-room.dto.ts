import { IsString } from "class-validator";

export class WsJoinRoomDto {
  @IsString()
  roomId!: string;
}
