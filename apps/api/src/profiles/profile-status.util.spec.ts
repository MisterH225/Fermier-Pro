import { ProfileModerationStatus } from "@prisma/client";
import {
  isProfileDeactivated,
  isProfileSanctioned,
  isProfileSelectable
} from "./profile-status.util";

describe("profile-status.util", () => {
  it("selectable = active uniquement", () => {
    expect(isProfileSelectable(ProfileModerationStatus.active)).toBe(true);
    expect(isProfileSelectable(ProfileModerationStatus.deactivated)).toBe(
      false
    );
    expect(isProfileSelectable(ProfileModerationStatus.banned)).toBe(false);
  });

  it("sanctionné = banned | suspended", () => {
    expect(isProfileSanctioned(ProfileModerationStatus.banned)).toBe(true);
    expect(isProfileSanctioned(ProfileModerationStatus.suspended)).toBe(true);
    expect(isProfileSanctioned(ProfileModerationStatus.deactivated)).toBe(
      false
    );
  });

  it("détecte deactivated", () => {
    expect(isProfileDeactivated(ProfileModerationStatus.deactivated)).toBe(
      true
    );
    expect(isProfileDeactivated(ProfileModerationStatus.active)).toBe(false);
  });
});
