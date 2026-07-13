import { apiGetJson, apiPostJson, apiPatchJson } from "./http";

/** GET/POST …/vet-consultations — scopes vet.read / vet.write. */
export type VetConsultationStatusDto =
  | "open"
  | "in_progress"
  | "resolved"
  | "cancelled";

export type VetConsultationListItemDto = {
  id: string;
  farmId: string;
  animalId: string | null;
  subject: string;
  summary: string | null;
  status: VetConsultationStatusDto;
  openedAt: string;
  closedAt: string | null;
  openedBy: { id: string; fullName: string | null };
  primaryVet: { id: string; fullName: string | null } | null;
  animal: {
    id: string;
    publicId: string;
    tagCode: string | null;
  } | null;
  attachments: Array<{ id: string }>;
};

export type VetConsultationAttachmentDto = {
  id: string;
  url: string;
  mimeType: string | null;
  label: string | null;
  createdAt: string;
  uploadedBy: { id: string; fullName: string | null };
};

export type VetConsultationDetailDto = Omit<
  VetConsultationListItemDto,
  "attachments" | "animal"
> & {
  attachments: VetConsultationAttachmentDto[];
  animal: {
    id: string;
    publicId: string;
    tagCode: string | null;
    status: string;
  } | null;
  openedBy: {
    id: string;
    fullName: string | null;
    email?: string | null;
  };
  primaryVet: {
    id: string;
    fullName: string | null;
    email?: string | null;
  } | null;
};

export function fetchVetConsultations(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  status?: VetConsultationStatusDto
): Promise<VetConsultationListItemDto[]> {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<VetConsultationListItemDto[]>(
    `/farms/${farmId}/vet-consultations${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchVetConsultation(
  accessToken: string,
  farmId: string,
  consultationId: string,
  activeProfileId?: string | null
): Promise<VetConsultationDetailDto> {
  return apiGetJson<VetConsultationDetailDto>(
    `/farms/${farmId}/vet-consultations/${consultationId}`,
    accessToken,
    activeProfileId
  );
}

export type CreateVetConsultationPayload = {
  subject: string;
  summary?: string;
  animalId?: string;
};

export function createVetConsultation(
  accessToken: string,
  farmId: string,
  payload: CreateVetConsultationPayload,
  activeProfileId?: string | null
): Promise<VetConsultationDetailDto> {
  return apiPostJson<VetConsultationDetailDto>(
    `/farms/${farmId}/vet-consultations`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type PatchVetConsultationPayload = {
  subject?: string;
  summary?: string | null;
  status?: VetConsultationStatusDto;
  primaryVetUserId?: string | null;
};

export function patchVetConsultation(
  accessToken: string,
  farmId: string,
  consultationId: string,
  payload: PatchVetConsultationPayload,
  activeProfileId?: string | null
): Promise<VetConsultationDetailDto> {
  return apiPatchJson<VetConsultationDetailDto>(
    `/farms/${farmId}/vet-consultations/${consultationId}`,
    payload,
    accessToken,
    activeProfileId
  );
}
/** POST pièce jointe (URL après dépôt stockage, ex. Supabase). */
export type AddVetConsultationAttachmentPayload = {
  url: string;
  mimeType?: string;
  label?: string;
};

export function addVetConsultationAttachment(
  accessToken: string,
  farmId: string,
  consultationId: string,
  payload: AddVetConsultationAttachmentPayload,
  activeProfileId?: string | null
): Promise<VetConsultationAttachmentDto> {
  return apiPostJson<VetConsultationAttachmentDto>(
    `/farms/${farmId}/vet-consultations/${consultationId}/attachments`,
    payload,
    accessToken,
    activeProfileId
  );
}
