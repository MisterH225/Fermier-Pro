import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getExpoPublicEnv } from "../env";

function tasksSocketBaseUrl(): string {
  const { apiUrl } = getExpoPublicEnv();
  if (!apiUrl?.trim()) {
    throw new Error("EXPO_PUBLIC_API_URL manquant");
  }
  return apiUrl.replace(/\/$/, "");
}

export type TasksSocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/**
 * Namespace `/tasks` — invalide les listes à chaque `taskChanged` (temps réel).
 */
export function useFarmTasksSocket(params: {
  farmId: string;
  accessToken: string;
  enabled: boolean;
}): { tasksSocketStatus: TasksSocketStatus } {
  const { farmId, accessToken, enabled } = params;
  const qc = useQueryClient();
  const [tasksSocketStatus, setTasksSocketStatus] =
    useState<TasksSocketStatus>("idle");

  useEffect(() => {
    if (!enabled || !accessToken || !farmId) {
      setTasksSocketStatus("idle");
      return;
    }

    let base: string;
    try {
      base = tasksSocketBaseUrl();
    } catch {
      setTasksSocketStatus("error");
      return;
    }

    setTasksSocketStatus("connecting");

    const socket = io(`${base}/tasks`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 8
    });

    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["farmTasks", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmTasksDashboard", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmTasksPendingCount", farmId] });
    };

    const join = () => {
      socket.emit("joinFarm", { farmId });
    };

    socket.on("connect", () => {
      setTasksSocketStatus("connected");
      join();
    });
    socket.on("disconnect", () => setTasksSocketStatus("disconnected"));
    socket.on("connect_error", () => setTasksSocketStatus("error"));
    socket.on("taskChanged", invalidate);

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("taskChanged", invalidate);
      socket.disconnect();
      setTasksSocketStatus("idle");
    };
  }, [farmId, accessToken, enabled, qc]);

  return { tasksSocketStatus };
}
