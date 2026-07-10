import { validate } from "class-validator";
import { InitiatePaymentDto } from "./initiate-payment.dto";

describe("InitiatePaymentDto", () => {
  it("rejette un corps vide (paymentMethod requis)", async () => {
    const dto = Object.assign(new InitiatePaymentDto(), {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === "paymentMethod")).toBe(true);
  });

  it("accepte wallet et mobile_money", async () => {
    for (const paymentMethod of ["wallet", "mobile_money"] as const) {
      const dto = Object.assign(new InitiatePaymentDto(), { paymentMethod });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });
});
