import chalk from "chalk";
import * as path from "node:path";
import type { Report } from "./types.js";

const ICONS = {
  critical: "🔴",
  warning:  "🟠",
  info:     "🟡",
} as const;

const COLORS = {
  critical: chalk.red,
  warning:  chalk.yellow,
  info:     chalk.cyan,
} as const;

export function render(report: Report): void {
  const { scriptName, durationMs, frames, flamegraphPath } = report;

  console.log();
  console.log(chalk.bold(`Bottleneck Report — ${scriptName} (${(durationMs / 1000).toFixed(1)}s sample)`));
  console.log(chalk.dim("─".repeat(72)));
  console.log();

  if (frames.length === 0) {
    console.log(chalk.dim("  No user-code frames found. Try --include-deps to include node_modules."));
    console.log();
    return;
  }

  for (const frame of frames) {
    const { name, url, lineNumber, selfTimeMs, selfTimePct, callCount, diagnosis } = frame;
    const { severity, explanation, fix } = diagnosis;

    const icon = ICONS[severity];
    const color = COLORS[severity];
    const location = url ? `${path.relative(process.cwd(), url)}:${lineNumber}` : "";
    const stats = [
      `${selfTimeMs.toFixed(0)}ms total`,
      `called ${callCount}x`,
      `${selfTimePct.toFixed(1)}% of CPU`,
    ].join(" — ");

    console.log(`${icon}  ${color.bold(name)}  ${chalk.dim(location)}`);
    console.log(`   ${chalk.dim(stats)}`);
    console.log(`   ${explanation}`);
    console.log(`   ${chalk.green("→")} ${fix}`);
    console.log();
  }

  if (flamegraphPath) {
    console.log(chalk.dim(`Full flamegraph saved to: ${flamegraphPath}`));
    console.log();
  }
}
