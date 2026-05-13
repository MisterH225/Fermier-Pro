import { createContext, useContext, type ReactNode } from "react";

const ProducerFabBottomLiftContext = createContext(0);

export function ProducerFabBottomLiftProvider({
  value,
  children
}: {
  value: number;
  children: ReactNode;
}) {
  return (
    <ProducerFabBottomLiftContext.Provider value={value}>
      {children}
    </ProducerFabBottomLiftContext.Provider>
  );
}

/** Marge additionnelle sous le FAB pour la barre d’onglets producteur fixe (0 si absent). */
export function useProducerFabBottomLift(): number {
  return useContext(ProducerFabBottomLiftContext);
}
