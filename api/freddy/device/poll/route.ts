import { NextResponse } from "next/server";
import { pollDeviceFlow } from "@/lib/freddy/oauth";

export async function POST() {
  const result = await pollDeviceFlow();
  return NextResponse.json(result);
}
