import {
  ApiError,
  isSubscriptionLimitError,
  parseApiErrorBody
} from "../api/http";

describe("parseApiErrorBody", () => {
  it("preserves Nest subscription limit code", () => {
    const parsed = parseApiErrorBody(
      JSON.stringify({
        statusCode: 403,
        code: "FARM_LIMIT_REACHED",
        message: "Limite de 1 projet actif atteinte."
      }),
      403,
      "Forbidden"
    );
    expect(parsed.code).toBe("FARM_LIMIT_REACHED");
    expect(parsed.message).toContain("projet");
  });

  it("detects subscription limit ApiError", () => {
    const err = new ApiError("Limite atteinte", 403, "SHOP_LIMIT_REACHED");
    expect(isSubscriptionLimitError(err)).toBe(true);
    expect(isSubscriptionLimitError(new Error("oops"))).toBe(false);
  });
});
