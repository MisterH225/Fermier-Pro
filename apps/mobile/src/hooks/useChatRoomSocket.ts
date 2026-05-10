import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getExpoPublicEnv } from "../env";
import type { ChatMessageDto } from "../lib/api";

function chatSocketBaseUrl(): string {
  const { apiUrl } = getExpoPublicEnv();
  if (!apiUrl?.trim()) {
    throw new Error("EXPO_PUBLIC_API_URL manquant");
  }
  return apiUrl.replace(/\/$/, "");
}

export type ChatSocketConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

/**
 * Connexion au namespace WebSocket `/chat`, joint le salon et met à jour le cache
 * TanStack Query à chaque événement `newMessage` (aligné sur `ChatGateway`).
 */
export function useChatRoomSocket(params: {
  roomId: string;
  accessToken: string;
  activeProfileId?: string | null;
  enabled: boolean;
}): { chatSocketStatus: ChatSocketConnectionStatus } {
  const { roomId, accessToken, activeProfileId, enabled } = params;
  const qc = useQueryClient();
  const [chatSocketStatus, setChatSocketStatus] =
    useState<ChatSocketConnectionStatus>("idle");

  useEffect(() => {
    if (!enabled || !accessToken || !roomId) {
      setChatSocketStatus("idle");
      return;
    }

    let base: string;
    try {
      base = chatSocketBaseUrl();
    } catch {
      setChatSocketStatus("error");
      return;
    }

    setChatSocketStatus("connecting");

    const socket = io(`${base}/chat`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 8
    });

    const mergeMessage = (msg: ChatMessageDto) => {
      if (msg.roomId !== roomId) return;
      qc.setQueryData<ChatMessageDto[]>(
        ["chatMessages", roomId, activeProfileId],
        (old) => {
          if (!old) return [msg];
          if (old.some((m) => m.id === msg.id)) return old;
          return [...old, msg];
        }
      );
      void qc.invalidateQueries({ queryKey: ["chatRooms", activeProfileId] });
    };

    const join = () => {
      socket.emit("joinRoom", { roomId });
    };

    const onConnect = () => {
      setChatSocketStatus("connected");
      join();
    };

    const onDisconnect = () => {
      setChatSocketStatus("disconnected");
    };

    const onConnectError = () => {
      setChatSocketStatus("error");
    };

    const onReconnectAttempt = () => {
      setChatSocketStatus("reconnecting");
    };

    const onReconnect = () => {
      setChatSocketStatus("connected");
      join();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("reconnect_attempt", onReconnectAttempt);
    socket.on("reconnect", onReconnect);
    socket.on("newMessage", mergeMessage);

    return () => {
      socket.emit("leaveRoom", { roomId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("reconnect_attempt", onReconnectAttempt);
      socket.off("reconnect", onReconnect);
      socket.off("newMessage", mergeMessage);
      socket.disconnect();
      setChatSocketStatus("idle");
    };
  }, [roomId, accessToken, activeProfileId, enabled, qc]);

  return { chatSocketStatus };
}
