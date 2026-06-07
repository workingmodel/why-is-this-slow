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

const MODE_LABEL = {
  cpu:    "CPU",
  memory: "Memory",
  io:     "Async I/O",
} as const;

function formatValue(selfTimeMs: number, mode: string): string {
  if (mode === "memory") {
    const kb = selfTimeMs / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
  }
  return selfTimeMs >= 1000
    ? `${(selfTimeMs / 1000).toFixed(2)}s`
    : `${selfTimeMs.toFixed(0)}ms`;
}

export function render(report: Report): void {
  const { scriptName, durationMs, frames, flamegraphPath, mode } = report;
  const modeLabel = MODE_LABEL[mode];

  console.log();
  console.log(chalk.bold(`${modeLabel} Bottleneck Report — ${scriptName} (${(durationMs / 1000).toFixed(1)}s sample)`));
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
    const location = url ? `${path.relative(process.cwd(), url.replace("file:", ""))}:${lineNumber}` : "";
    const valueStr = formatValue(selfTimeMs, mode);
    const callStr = mode !== "memory" ? ` — called ${callCount}x` : "";
    const stats = `${valueStr}${callStr} — ${selfTimePct.toFixed(1)}% of ${modeLabel.toLowerCase()}`;

    console.log(`${icon}  ${color.bold(name)}${location ? `  ${chalk.dim(location)}` : ""}`);
    console.log(`   ${chalk.dim(stats)}`);
    console.log(`   ${explanation}`);
    console.log(`   ${chalk.green("→")} ${fix}`);
    console.log();
  }

  if (flamegraphPath) {
    console.log(chalk.dim(`Flamegraph saved → ${flamegraphPath}`));
    console.log(chalk.dim(`Open at: https://www.speedscope.app (drag and drop the file)`));
    console.log();
  }
}

export function renderJson(report: Report): void {
  console.log(JSON.stringify(report, null, 2));
}
