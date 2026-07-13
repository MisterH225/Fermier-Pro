import { apiGetJson, apiPostJson, apiPatchJson, apiDeleteJson } from "./http";

export type FarmTaskDto = {
  id: string;
  farmId?: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  reminder?: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  assignedUserId?: string | null;
  animalId?: string | null;
  assignee: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  creator?: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
  completedBy?: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  animal?: {
    id: string;
    publicId: string;
    tagCode: string | null;
    species: { id: string; code: string; name: string };
    breed: { id: string; name: string } | null;
  } | null;
};

export function fetchFarmTasks(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  status?: string,
  assignedTo?: string,
  period?: string
): Promise<FarmTaskDto[]> {
  const qs = new URLSearchParams();
  if (status && status !== "all") {
    qs.set("status", status);
  }
  if (assignedTo) {
    qs.set("assigned_to", assignedTo);
  }
  if (period) {
    qs.set("period", period);
  }
  const q = qs.toString();
  return apiGetJson<FarmTaskDto[]>(
    `/farms/${farmId}/tasks${q ? `?${q}` : ""}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmTasksPendingCount(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{ pendingCount: number }> {
  return apiGetJson<{ pendingCount: number }>(
    `/farms/${farmId}/tasks/summary`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmTask(
  accessToken: string,
  farmId: string,
  taskId: string,
  activeProfileId?: string | null
): Promise<FarmTaskDto> {
  return apiGetJson<FarmTaskDto>(
    `/farms/${farmId}/tasks/${taskId}`,
    accessToken,
    activeProfileId
  );
}

export type MyTasksDashboardDto = {
  pendingCount: number;
  tasks: FarmTaskDto[];
};

export function fetchMyTasksDashboard(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  period?: string
): Promise<MyTasksDashboardDto> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : "";
  return apiGetJson<MyTasksDashboardDto>(
    `/farms/${farmId}/tasks/my-dashboard${qs}`,
    accessToken,
    activeProfileId
  );
}

export type CreateFarmTaskPayload = {
  title: string;
  description?: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  status?: "pending" | "todo" | "in_progress" | "done" | "cancelled";
  dueAt?: string;
  assignedUserId?: string;
  animalId?: string;
  reminder?: "j_minus_1" | "j_zero" | "both";
};

export function createFarmTask(
  accessToken: string,
  farmId: string,
  payload: CreateFarmTaskPayload,
  activeProfileId?: string | null
): Promise<FarmTaskDto> {
  const body = {
    ...payload,
    priority:
      payload.priority === "urgent" ? "high" : payload.priority,
    status:
      payload.status === "pending" ? "todo" : payload.status
  };
  return apiPostJson<FarmTaskDto>(
    `/farms/${farmId}/tasks`,
    body,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmTaskPayload = {
  title?: string;
  description?: string | null;
  category?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  status?: "pending" | "todo" | "in_progress" | "done" | "cancelled";
  dueAt?: string | null;
  completedAt?: string | null;
  assignedUserId?: string | null;
  animalId?: string | null;
  reminder?: "j_minus_1" | "j_zero" | "both" | null;
};

export function patchFarmTask(
  accessToken: string,
  farmId: string,
  taskId: string,
  payload: PatchFarmTaskPayload,
  activeProfileId?: string | null
): Promise<FarmTaskDto> {
  const body = {
    ...payload,
    priority:
      payload.priority === "urgent" ? "high" : payload.priority,
    status:
      payload.status === "pending" ? "todo" : payload.status
  };
  return apiPatchJson<FarmTaskDto>(
    `/farms/${farmId}/tasks/${taskId}`,
    body,
    accessToken,
    activeProfileId
  );
}

export function patchFarmTaskStatus(
  accessToken: string,
  farmId: string,
  taskId: string,
  status: string,
  activeProfileId?: string | null
): Promise<FarmTaskDto> {
  const mapped = status === "pending" ? "todo" : status;
  return apiPatchJson<FarmTaskDto>(
    `/farms/${farmId}/tasks/${taskId}/status`,
    { status: mapped },
    accessToken,
    activeProfileId
  );
}

export function deleteFarmTask(
  accessToken: string,
  farmId: string,
  taskId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/tasks/${taskId}`,
    accessToken,
    activeProfileId
  );
}
