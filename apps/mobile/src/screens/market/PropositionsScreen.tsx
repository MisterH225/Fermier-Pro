import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabSelector } from "../../components/tabs";
import { useActiveProject } from "../../context/ActiveProjectContext";
import { useSession } from "../../context/SessionContext";
import { fetchMarketplaceOfferCounts } from "../../lib/api";
import type { RootStackParamList } from "../../types/navigation";
import { PropositionsEnvoyeesTab } from "./tabs/PropositionsEnvoyeesTab";
import { PropositionsRecuesTab } from "./tabs/PropositionsRecuesTab";

export type ProposalsSubTab = "received" | "sent";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  contentPaddingBottom: number;
  initialSubTab?: ProposalsSubTab;
  listingIdFilter?: string | null;
  highlightOfferId?: string;
  /** Mode acheteur : uniquement les propositions envoyées. */
  buyerSentOnly?: boolean;
};

export function PropositionsScreen({
  navigation,
  contentPaddingBottom,
  initialSubTab = "received",
  listingIdFilter,
  highlightOfferId,
  buyerSentOnly = false
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const { activeFarmId } = useActiveProject();
  const [subTab, setSubTab] = useState<ProposalsSubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const countsQ = useQuery({
    queryKey: ["marketplaceOffersCounts", activeProfileId, activeFarmId],
    queryFn: () =>
      fetchMarketplaceOfferCounts(accessToken!, activeProfileId, activeFarmId),
    enabled: Boolean(accessToken)
  });

  const receivedBadge = countsQ.data?.receivedPending ?? 0;
  const sentBadge = countsQ.data?.sentPending ?? 0;

  if (buyerSentOnly) {
    return (
      <PropositionsEnvoyeesTab
        navigation={navigation}
        listingIdFilter={listingIdFilter}
        highlightOfferId={highlightOfferId}
        contentPaddingBottom={contentPaddingBottom}
      />
    );
  }

  return (
    <TabSelector
      activeTab={subTab}
      onTabChange={(key) => setSubTab(key as ProposalsSubTab)}
      tabs={[
        {
          key: "received",
          label: t("marketScreen.proposals.tabReceived"),
          badge: receivedBadge > 0 ? receivedBadge : undefined,
          content: (
            <PropositionsRecuesTab
              navigation={navigation}
              farmId={activeFarmId}
              listingIdFilter={listingIdFilter}
              highlightOfferId={highlightOfferId}
              contentPaddingBottom={contentPaddingBottom}
            />
          )
        },
        {
          key: "sent",
          label: t("marketScreen.proposals.tabSent"),
          badge: sentBadge > 0 ? sentBadge : undefined,
          content: (
            <PropositionsEnvoyeesTab
              navigation={navigation}
              listingIdFilter={listingIdFilter}
              highlightOfferId={highlightOfferId}
              contentPaddingBottom={contentPaddingBottom}
            />
          )
        }
      ]}
    />
  );
}
