import type { Response } from "express";

/** En-têtes RFC 8594 pour routes dépréciées avec successeur explicite. */
export function setDeprecatedSuccessor(
  res: Response,
  successorPath: string,
  sunset = "Sat, 01 Jan 2027 00:00:00 GMT"
): void {
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", sunset);
  res.setHeader("Link", `<${successorPath}>; rel="successor-version"`);
}
