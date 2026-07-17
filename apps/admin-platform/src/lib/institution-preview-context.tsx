"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useAdminAccess } from "@/lib/admin-access-context";

type InstitutionPreviewContextValue = {
  viewAsInstitutionId: string | null;
  viewAsInstitutionLabel: string | null;
  setInstitutionPreview: (id: string | null, label: string | null) => void;
  clearInstitutionPreview: () => void;
  isPreviewActive: boolean;
};

const InstitutionPreviewContext = createContext<InstitutionPreviewContextValue>({
  viewAsInstitutionId: null,
  viewAsInstitutionLabel: null,
  setInstitutionPreview: () => {},
  clearInstitutionPreview: () => {},
  isPreviewActive: false
});

export function InstitutionPreviewProvider({ children }: { children: ReactNode }) {
  const { profile } = useAdminAccess();
  const [viewAsInstitutionId, setViewAsInstitutionId] = useState<string | null>(
    null
  );
  const [viewAsInstitutionLabel, setViewAsInstitutionLabel] = useState<
    string | null
  >(null);

  const setInstitutionPreview = useCallback(
    (id: string | null, label: string | null) => {
      if (profile?.role !== "superadmin") {
        return;
      }
      setViewAsInstitutionId(id);
      setViewAsInstitutionLabel(label);
    },
    [profile?.role]
  );

  const clearInstitutionPreview = useCallback(() => {
    setViewAsInstitutionId(null);
    setViewAsInstitutionLabel(null);
  }, []);

  const value = useMemo(
    () => ({
      viewAsInstitutionId:
        profile?.role === "superadmin" ? viewAsInstitutionId : null,
      viewAsInstitutionLabel:
        profile?.role === "superadmin" ? viewAsInstitutionLabel : null,
      setInstitutionPreview,
      clearInstitutionPreview,
      isPreviewActive:
        profile?.role === "superadmin" && viewAsInstitutionId != null
    }),
    [
      profile?.role,
      viewAsInstitutionId,
      viewAsInstitutionLabel,
      setInstitutionPreview,
      clearInstitutionPreview
    ]
  );

  return (
    <InstitutionPreviewContext.Provider value={value}>
      {children}
    </InstitutionPreviewContext.Provider>
  );
}

export function useInstitutionPreview() {
  return useContext(InstitutionPreviewContext);
}
