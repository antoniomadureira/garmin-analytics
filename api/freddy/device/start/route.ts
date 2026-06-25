import { NextResponse } from "next/server";
import { startDeviceFlow } from "@/lib/freddy/oauth";

export async function POST() {
  try {
    const flow = await startDeviceFlow();
    return NextResponse.json({
      verificationUrl: flow.verification_uri_complete,
      intervalSeconds: flow.interval,
      expiresInSeconds: flow.expires_in,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
