import { NextResponse } from "next/server";

/** Healthcheck Railway — hors i18n / auth (voir middleware matcher). */
export function GET() {
  return NextResponse.json({ status: "ok", service: "fermier-admin" });
}
