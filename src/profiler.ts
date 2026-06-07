import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execa } from "execa";

export interface ProfileResult {
  profilePath: string;
  cleanup: () => void;
}

const LAUNCHER = path.join(__dirname, "launcher.js");
const IO_LAUNCHER = path.join(__dirname, "io-launcher.js");

export async function profileCpu(
  command: string,
  scriptArgs: string[],
  durationMs: number
): Promise<ProfileResult> {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wm-profile-"));
  const scriptPath = path.resolve(scriptArgs[0] ?? "");
  const extraArgs = scriptArgs.slice(1);
  const nodeBin = command === "node" ? process.execPath : command;

  await execa(
    nodeBin,
    [
      "--cpu-prof",
      `--cpu-prof-dir=${outDir}`,
      "--cpu-prof-interval=1000",
      LAUNCHER,
      scriptPath,
      String(durationMs),
      ...extraArgs,
    ],
    { cwd: outDir, env: process.env, reject: false, stdio: "inherit" }
  );

  const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".cpuprofile"));
  if (files.length === 0) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error(
      `No .cpuprofile generated. Make sure the script path is correct and the file is a CommonJS module.`
    );
  }

  return makeResult(path.join(outDir, files[0]!), outDir);
}

export async function profileMemory(
  command: string,
  scriptArgs: string[],
  durationMs: number
): Promise<ProfileResult> {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wm-profile-"));
  const scriptPath = path.resolve(scriptArgs[0] ?? "");
  const extraArgs = scriptArgs.slice(1);
  const nodeBin = command === "node" ? process.execPath : command;

  await execa(
    nodeBin,
    [
      "--heap-prof",
      `--heap-prof-dir=${outDir}`,
      LAUNCHER,
      scriptPath,
      String(durationMs),
      ...extraArgs,
    ],
    { cwd: outDir, env: process.env, reject: false, stdio: "inherit" }
  );

  const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".heapprofile"));
  if (files.length === 0) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error(`No .heapprofile generated.`);
  }

  return makeResult(path.join(outDir, files[0]!), outDir);
}

export async function profileIo(
  command: string,
  scriptArgs: string[],
  durationMs: number
): Promise<ProfileResult> {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wm-profile-"));
  const reportPath = path.join(outDir, "io-report.json");
  const scriptPath = path.resolve(scriptArgs[0] ?? "");
  const extraArgs = scriptArgs.slice(1);
  const nodeBin = command === "node" ? process.execPath : command;

  await execa(
    nodeBin,
    [IO_LAUNCHER, scriptPath, String(durationMs), reportPath, ...extraArgs],
    { cwd: process.cwd(), env: process.env, reject: false, stdio: "inherit" }
  );

  if (!fs.existsSync(reportPath)) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error(`No I/O report generated.`);
  }

  return makeResult(reportPath, outDir);
}

function makeResult(profilePath: string, outDir: string): ProfileResult {
  return {
    profilePath,
    cleanup: () => {
      try {
        fs.rmSync(outDir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}
