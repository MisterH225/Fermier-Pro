import { createContext, useContext, type ReactNode } from "react";

const ProducerBottomChromeContext = createContext(0);

/** Hauteur à réserver sous le contenu pour la barre flottante producteur + safe area. */
export function ProducerBottomChromeProvider({
  value,
  children
}: {
  value: number;
  children: ReactNode;
}) {
  return (
    <ProducerBottomChromeContext.Provider value={value}>
      {children}
    </ProducerBottomChromeContext.Provider>
  );
}

export function useProducerBottomChromePad(): number {
  return useContext(ProducerBottomChromeContext);
}
