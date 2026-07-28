import {
  isNavigationReady,
  navigateFromGenericPushData
} from "../DeepNavigationService";

describe("isNavigationReady", () => {
  it("returns false for null/undefined", () => {
    expect(isNavigationReady(null)).toBe(false);
    expect(isNavigationReady(undefined)).toBe(false);
  });

  it("returns true for stack-like navigation without isReady", () => {
    const stackNav = { navigate: jest.fn() };
    expect(isNavigationReady(stackNav as never)).toBe(true);
  });

  it("delegates to isReady when present", () => {
    expect(
      isNavigationReady({ navigate: jest.fn(), isReady: () => false } as never)
    ).toBe(false);
    expect(
      isNavigationReady({ navigate: jest.fn(), isReady: () => true } as never)
    ).toBe(true);
  });
});

describe("navigateFromGenericPushData (inbox / stack nav)", () => {
  it("navigates to VetAppointmentDetail without throwing when isReady is absent", () => {
    const navigate = jest.fn();
    const stackNav = { navigate };

    expect(() =>
      navigateFromGenericPushData(stackNav as never, {
        type: "vet_appointment_refused_by_producer",
        appointmentId: "appt-1",
        farmId: "farm-1"
      })
    ).not.toThrow();

    expect(navigate).toHaveBeenCalledWith("VetAppointmentDetail", {
      appointmentId: "appt-1"
    });
  });

  it("opens producer proposal notification (vet_appointment_proposed) from stack nav", () => {
    const navigate = jest.fn();
    expect(() =>
      navigateFromGenericPushData({ navigate } as never, {
        type: "vet_appointment_proposed",
        appointmentId: "appt-proposed-1",
        farmId: "farm-1"
      })
    ).not.toThrow();
    expect(navigate).toHaveBeenCalledWith("VetAppointmentDetail", {
      appointmentId: "appt-proposed-1"
    });
  });

  it("returns false when container isReady is false", () => {
    const navigate = jest.fn();
    const result = navigateFromGenericPushData(
      { navigate, isReady: () => false } as never,
      {
        type: "vet_appointment_refused_by_producer",
        appointmentId: "appt-1"
      }
    );
    expect(result).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("returns false without appointmentId", () => {
    const navigate = jest.fn();
    const result = navigateFromGenericPushData(
      { navigate } as never,
      { type: "vet_appointment_proposed" }
    );
    expect(result).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
