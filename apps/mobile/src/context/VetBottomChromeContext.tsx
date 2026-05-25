import { createContext, useContext } from "react";

const VetBottomChromeContext = createContext(0);

export function VetBottomChromeProvider({
  value,
  children
}: {
  value: number;
  children: React.ReactNode;
}) {
  return (
    <VetBottomChromeContext.Provider value={value}>
      {children}
    </VetBottomChromeContext.Provider>
  );
}

export function useVetBottomChromePad(): number {
  return useContext(VetBottomChromeContext);
}
