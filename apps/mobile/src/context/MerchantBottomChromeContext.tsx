import { createContext, useContext } from "react";

const Ctx = createContext(0);

export function MerchantBottomChromeProvider({
  value,
  children
}: {
  value: number;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMerchantBottomChromePad(): number {
  return useContext(Ctx);
}
