import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSession } from "../context/SessionContext";
import { fetchChatRooms } from "../lib/api";

/** Charge et rafraîchit la liste des salons au focus. */
export function useChatRoomsQuery(scope: string) {
  const { accessToken, activeProfileId } = useSession();

  const query = useQuery({
    queryKey: ["chatRooms", activeProfileId, scope],
    queryFn: () => fetchChatRooms(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch])
  );

  return query;
}
