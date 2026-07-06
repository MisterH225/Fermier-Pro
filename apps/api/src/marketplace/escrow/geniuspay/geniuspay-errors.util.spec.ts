import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException
} from "@nestjs/common";
import { throwGeniusPayUserError } from "./geniuspay-errors.util";

describe("throwGeniusPayUserError", () => {
  it("mappe INVALID_API_KEY vers ServiceUnavailable", () => {
    expect(() =>
      throwGeniusPayUserError({
        httpStatus: 401,
        code: "INVALID_API_KEY",
        message: "The provided API key is invalid.",
        operation: "create"
      })
    ).toThrow(ServiceUnavailableException);
  });

  it("mappe VALIDATION_ERROR vers BadRequest sans code HTTP", () => {
    try {
      throwGeniusPayUserError({
        httpStatus: 422,
        code: "VALIDATION_ERROR",
        message: "amount must be positive",
        operation: "create"
      });
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toContain("GeniusPay refusé");
      expect((err as BadRequestException).message).not.toMatch(/\b404\b/i);
    }
  });

  it("évite les messages HTTP bruts par défaut", () => {
    try {
      throwGeniusPayUserError({
        httpStatus: 404,
        operation: "create"
      });
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayException);
      expect((err as BadGatewayException).message).not.toMatch(/\b404\b/);
    }
  });
});
