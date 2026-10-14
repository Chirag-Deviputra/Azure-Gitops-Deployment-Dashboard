import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
  try {
    const response = await fetch(`${backendUrl}/api/applications`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: `Backend returned ${response.status}` }, { status: 502 });
    }
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Backend service unavailable" }, { status: 502 });
  }
}
