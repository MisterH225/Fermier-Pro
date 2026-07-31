/**
 * Routage unifié validation composition :
 * carte dashboard (compositionId) et notif → FeedCompositionDetail.
 */

import { navigateFromGenericPushData } from "../DeepNavigationService";

/** Miroir de la logique Dashboard / Agenda (évite d'importer React Navigation). */
export function destinationForUpcomingVisit(v: {
  kind?: "consultation" | "appointment";
  id: string;
  farmId: string;
  farmName: string;
  compositionId?: string | null;
}): { screen: string; params: Record<string, string> } {
  if (v.kind === "appointment") {
    return {
      screen: "VetAppointmentDetail",
      params: { appointmentId: v.id }
    };
  }
  if (v.compositionId) {
    return {
      screen: "FeedCompositionDetail",
      params: {
        farmId: v.farmId,
        farmName: v.farmName,
        compositionId: v.compositionId
      }
    };
  }
  return {
    screen: "VetConsultationDetail",
    params: {
      farmId: v.farmId,
      farmName: v.farmName,
      consultationId: v.id
    }
  };
}

describe("routage validation composition (deux portes)", () => {
  it("carte dashboard avec compositionId → FeedCompositionDetail", () => {
    expect(
      destinationForUpcomingVisit({
        kind: "consultation",
        id: "consult-1",
        farmId: "farm-1",
        farmName: "Ferme A",
        compositionId: "comp-1"
      })
    ).toEqual({
      screen: "FeedCompositionDetail",
      params: {
        farmId: "farm-1",
        farmName: "Ferme A",
        compositionId: "comp-1"
      }
    });
  });

  it("consultation classique sans compositionId → VetConsultationDetail", () => {
    expect(
      destinationForUpcomingVisit({
        kind: "consultation",
        id: "consult-2",
        farmId: "farm-1",
        farmName: "Ferme A",
        compositionId: null
      }).screen
    ).toBe("VetConsultationDetail");
  });

  it("notification feed_composition_vet_review → même écran Composition", () => {
    const navigate = jest.fn();
    navigateFromGenericPushData({ navigate } as never, {
      type: "feed_composition_vet_review",
      farmId: "farm-1",
      farmName: "Ferme A",
      compositionId: "comp-1",
      roomId: "room-1",
      consultationId: "consult-1"
    });
    expect(navigate).toHaveBeenCalledWith("FeedCompositionDetail", {
      farmId: "farm-1",
      farmName: "Ferme A",
      compositionId: "comp-1"
    });
  });
});
