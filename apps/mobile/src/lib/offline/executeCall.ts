import {
  apiDeleteJson,
  apiPatchJson,
  apiPostJson,
  apiPutJson
} from "../api";
import type { OfflineApiCall } from "./types";

export async function executeOfflineApiCall(
  call: OfflineApiCall,
  accessToken: string,
  activeProfileId?: string | null
): Promise<unknown> {
  const path = call.path.startsWith("/") ? call.path : `/${call.path}`;
  switch (call.method) {
    case "POST":
      return apiPostJson(path, call.body, accessToken, activeProfileId);
    case "PUT":
      return apiPutJson(path, call.body, accessToken, activeProfileId);
    case "PATCH":
      return apiPatchJson(path, call.body, accessToken, activeProfileId);
    case "DELETE":
      return apiDeleteJson(path, accessToken, activeProfileId);
    default:
      throw new Error(`Méthode HTTP non supportée: ${call.method}`);
  }
}
