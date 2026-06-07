import * as path from "node:path";
import chalk from "chalk";
import { profile } from "./profiler.js";
import { parseProfile } from "./parser.js";
import { analyze } from "./analyzer.js";
import { render } from "./renderer.js";
import type { Report } from "./types.js";

interface CliOptions {
  command: string;
  args: string[];
  duration: number;
  topN: number;
  includeDeps: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);

  let duration = 10_000;
  let topN = 10;
  let includeDeps = false;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--duration" || arg === "-d") {
      duration = Number(args[++i]) * 1000;
    } else if (arg === "--top") {
      topN = Number(args[++i]);
    } else if (arg === "--include-deps") {
      includeDeps = true;
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
  };
}

function printHelp(): void {
  console.log(`
${chalk.bold("wm-why-is-this-slow")} — zero-config Node.js profiler

${chalk.bold("Usage:")}
  wm-why-is-this-slow <command> [script] [...args]

${chalk.bold("Examples:")}
  wm-why-is-this-slow node server.js
  wm-why-is-this-slow node scripts/migrate.js
  wm-why-is-this-slow node index.js --duration 30

${chalk.bold("Options:")}
  --duration, -d <s>   Profile for this many seconds (default: 10)
  --top <n>            Show top N bottlenecks (default: 10)
  --include-deps       Include node_modules frames (hidden by default)
  --help, -h           Show this help
`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const scriptName = path.basename(opts.args[0] ?? opts.command);

  console.log(chalk.dim(`\nProfiling ${scriptName} for ${opts.duration / 1000}s…`));

  let result;
  try {
    result = await profile(opts.command, opts.args, opts.duration);
  } catch (err) {
    console.error(chalk.red(`\nFailed to profile: ${(err as Error).message}`));
    process.exit(1);
  }

  const { frames, durationMs } = parseProfile(result.profilePath);
  const diagnosed = analyze(frames, { topN: opts.topN, includeDeps: opts.includeDeps });

  const report: Report = {
    scriptName,
    durationMs,
    frames: diagnosed,
    flamegraphPath: null,
  };

  render(report);
  result.cleanup();
}

main().catch((err: unknown) => {
  console.error(chalk.red((err as Error).message));
  process.exit(1);
});
