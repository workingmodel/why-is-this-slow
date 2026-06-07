import * as path from "node:path";
import chalk from "chalk";
import { profileCpu, profileMemory, profileIo } from "./profiler.js";
import { parseProfile } from "./parser.js";
import { parseHeapProfile } from "./heap-parser.js";
import { parseIoReport } from "./io-parser.js";
import { analyze } from "./analyzer.js";
import { render, renderJson } from "./renderer.js";
import { writeFlamegraph } from "./flamegraph.js";
import type { Report, ProfilingMode } from "./types.js";

interface CliOptions {
  command: string;
  args: string[];
  duration: number;
  topN: number;
  includeDeps: boolean;
  mode: ProfilingMode;
  json: boolean;
  flamegraph: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);

  let duration = 10_000;
  let topN = 10;
  let includeDeps = false;
  let mode: ProfilingMode = "cpu";
  let json = false;
  let flamegraph = false;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--duration" || arg === "-d") {
      duration = Number(args[++i]) * 1000;
    } else if (arg === "--top") {
      topN = Number(args[++i]);
    } else if (arg === "--include-deps") {
      includeDeps = true;
    } else if (arg === "--memory") {
      mode = "memory";
    } else if (arg === "--io") {
      mode = "io";
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--flamegraph") {
      flamegraph = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length === 0) {
    printHelp();
    process.exit(1);
  }

  return {
    command: positional[0]!,
    args: positional.slice(1),
    duration,
    topN,
    includeDeps,
    mode,
    json,
    flamegraph,
  };
}

function printHelp(): void {
  console.log(`
${chalk.bold("wm-why-is-this-slow")} — zero-config Node.js profiler

${chalk.bold("Usage:")}
  wm-why-is-this-slow <command> [script] [...args]

${chalk.bold("Examples:")}
  wm-why-is-this-slow node server.js
  wm-why-is-this-slow node server.js --duration 30
  wm-why-is-this-slow node server.js --memory
  wm-why-is-this-slow node server.js --io
  wm-why-is-this-slow node server.js --json > report.json
  wm-why-is-this-slow node server.js --flamegraph

${chalk.bold("Options:")}
  --duration, -d <s>   Profile for this many seconds (default: 10)
  --top <n>            Show top N bottlenecks (default: 10)
  --include-deps       Include node_modules frames (hidden by default)
  --memory             Profile heap allocations instead of CPU
  --io                 Profile async I/O wait time instead of CPU
  --json               Output machine-readable JSON
  --flamegraph         Save a speedscope-compatible flamegraph to .wm-profile/
  --help, -h           Show this help
`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const scriptName = path.basename(opts.args[0] ?? opts.command);

  if (!opts.json) {
    const modeLabel = opts.mode === "memory" ? "memory" : opts.mode === "io" ? "I/O" : "CPU";
    console.log(chalk.dim(`\nProfiling ${scriptName} (${modeLabel}) for ${opts.duration / 1000}s…`));
  }

  let profilePath: string;
  let cleanup: () => void;

  try {
    let result;
    if (opts.mode === "memory") {
      result = await profileMemory(opts.command, opts.args, opts.duration);
    } else if (opts.mode === "io") {
      result = await profileIo(opts.command, opts.args, opts.duration);
    } else {
      result = await profileCpu(opts.command, opts.args, opts.duration);
    }
    profilePath = result.profilePath;
    cleanup = result.cleanup;
  } catch (err) {
    console.error(chalk.red(`\nFailed to profile: ${(err as Error).message}`));
    process.exit(1);
  }

  let frames;
  let durationMs: number;
  let totalBytes: number | undefined;

  if (opts.mode === "memory") {
    const parsed = parseHeapProfile(profilePath);
    frames = parsed.frames;
    durationMs = opts.duration;
    totalBytes = parsed.totalBytes;
  } else if (opts.mode === "io") {
    const parsed = parseIoReport(profilePath);
    frames = parsed.frames;
    durationMs = parsed.totalMs;
  } else {
    const parsed = parseProfile(profilePath);
    frames = parsed.frames;
    durationMs = parsed.durationMs;
  }

  const diagnosed = analyze(frames, { topN: opts.topN, includeDeps: opts.includeDeps, mode: opts.mode });

  let flamegraphPath: string | null = null;
  if (opts.flamegraph && diagnosed.length > 0) {
    flamegraphPath = writeFlamegraph(diagnosed, durationMs, scriptName, ".wm-profile");
  }

  const report: Report = {
    scriptName,
    durationMs,
    frames: diagnosed,
    flamegraphPath,
    mode: opts.mode,
    totalBytes,
  };

  if (opts.json) {
    renderJson(report);
  } else {
    render(report);
  }

  cleanup();
}

main().catch((err: unknown) => {
  console.error(chalk.red((err as Error).message));
  process.exit(1);
});
