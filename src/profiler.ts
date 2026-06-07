import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execa } from "execa";

export interface ProfileResult {
  profilePath: string;
  cleanup: () => void;
}

// launcher.js lives next to this file in src/ (and in dist/ after build)
const LAUNCHER = path.join(__dirname, "launcher.js");

export async function profile(
  command: string,
  scriptArgs: string[],
  durationMs: number
): Promise<ProfileResult> {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wm-profile-"));
  const scriptPath = path.resolve(scriptArgs[0] ?? "");
  const extraArgs = scriptArgs.slice(1);

  // Resolve the node binary
  const nodeBin = command === "node" ? process.execPath : command;

  // Spawn: node --cpu-prof --cpu-prof-dir=<outDir> launcher.js <script> <duration> [...extra]
  const child = execa(
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
    {
      cwd: outDir, // profile written relative to cwd — point at outDir to be sure
      env: process.env,
      reject: false,
      stdio: "inherit",
    }
  );

  await child;

  const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".cpuprofile"));
  if (files.length === 0) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error(
      `No .cpuprofile generated. Make sure the script path is correct and the file is a CommonJS module.`
    );
  }

  return {
    profilePath: path.join(outDir, files[0]!),
    cleanup: () => {
      try {
        fs.rmSync(outDir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}
