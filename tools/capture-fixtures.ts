/**
 * Captures raw Freddy MCP query_metrics responses for use as test fixtures.
 * Run via: npm run fixtures:capture
 *
 * The npm script uses node --env-file=.env.local so env vars (UPSTASH_*, etc.)
 * are set BEFORE lib/redis.ts calls Redis.fromEnv() at module-init time.
 *
 * Each fixture is written byte-for-byte as received. Emails and bearer tokens
 * are replaced with REDACTED_* if detected; a header comment is prepended.
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getFreddyClient } from "../lib/freddy/client";

const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");

const REDACT_RE: Array<[RegExp, string]> = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "REDACTED_EMAIL"],
  [/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer REDACTED_TOKEN"],
];

function redact(text: string): { out: string; changed: boolean } {
  let out = text;
  let changed = false;
  for (const [re, rep] of REDACT_RE) {
    re.lastIndex = 0;
    if (re.test(out)) {
      re.lastIndex = 0;
      out = out.replace(re, rep);
      changed = true;
    }
    re.lastIndex = 0;
  }
  return { out, changed };
}

type ToolArgs = {
  metrics: string[];
  days?: number;
  start?: string;
  end?: string;
  include_raw?: boolean;
};

async function capture(name: string, args: ToolArgs): Promise<void> {
  const client = await getFreddyClient();
  const result = await client.callTool({ name: "query_metrics", arguments: args });

  const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
  const text = content?.find((c) => c.type === "text")?.text;
  if (text === undefined) {
    throw new Error(`no text block — keys: ${JSON.stringify(Object.keys(result ?? {}))}`);
  }

  const { out, changed } = redact(text);
  const prefix = changed
    ? `# FIXTURE: ${name}.txt\n# REDACTED: emails/tokens replaced with REDACTED_*\n\n`
    : "";

  await writeFile(path.join(FIXTURES_DIR, `${name}.txt`), prefix + out, "utf8");
  const bytes = Buffer.byteLength(out, "utf8");
  const lines = out.split("\n").length;
  console.log(`  ✓  ${name}.txt  ${bytes} bytes / ${lines} lines${changed ? " [REDACTED]" : ""}`);
}

const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

const FIXTURES: Array<[string, ToolArgs]> = [
  [
    "wellness",
    { metrics: ["wellness_restingHR"], days: 7, include_raw: true },
  ],
  [
    "training-load",
    {
      metrics: [
        "acuteTrainingLoad_dailyTrainingLoadAcute",
        "acuteTrainingLoad_dailyTrainingLoadChronic",
        "acuteTrainingLoad_dailyAcuteChronicWorkloadRatio",
        "acuteTrainingLoad_acwrStatus",
      ],
      days: 90,
      include_raw: true,
    },
  ],
  [
    "activity-detail",
    {
      metrics: [
        "activity_distanceInMeters",
        "activity_durationInSeconds",
        "activity_averageHeartRateInBeatsPerMinute",
        "activityDetail_samples",
      ],
      days: 7,
      include_raw: true,
    },
  ],
  [
    "icu-hr-zones",
    { metrics: ["activity_icu_hr_zone_times"], days: 21, include_raw: true },
  ],
  [
    "no-data",
    { metrics: ["wellness_restingHR"], start: future, end: future },
  ],
  [
    "multi-day-mixed",
    { metrics: ["wellness_restingHR"], days: 14, include_raw: true },
  ],
];

async function main(): Promise<void> {
  await mkdir(FIXTURES_DIR, { recursive: true });
  console.log(`\nCapturing Freddy fixtures → ${FIXTURES_DIR}\n`);

  for (const [name, args] of FIXTURES) {
    process.stdout.write(`  ${name}... `);
    try {
      await capture(name, args);
    } catch (err) {
      console.error(`FAILED: ${String(err)}`);
    }
    // Stay within Freddy's ~3 concurrent request limit
    await new Promise<void>((r) => setTimeout(r, 600));
  }

  console.log("\nDone. Verify tests/fixtures/ before continuing with test suite.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
