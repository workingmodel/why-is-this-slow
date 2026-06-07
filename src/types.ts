export interface HotFrame {
  name: string;
  url: string;
  lineNumber: number;
  selfTimeMs: number;
  selfTimePct: number;
  callCount: number;
  isUserCode: boolean;
}

export interface RuleMatch {
  severity: "critical" | "warning" | "info";
  explanation: string;
  fix: string;
}

export interface DiagnosedFrame extends HotFrame {
  diagnosis: RuleMatch;
}

export interface Report {
  scriptName: string;
  durationMs: number;
  frames: DiagnosedFrame[];
  flamegraphPath: string | null;
}
