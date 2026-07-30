export interface UiElementLaunchAgentInput {
  label: string;
  nodePath: string;
  workingDirectory: string;
  environmentFile: string;
  extractionScript: string;
  app: string;
  platform: "ios" | "android" | "web";
  versionNumber: number;
  limit: number;
  concurrency: number;
  restartOnFailure?: boolean;
  reportPath: string;
  stdoutPath: string;
  stderrPath: string;
  environment: {
    path: string;
    home: string;
    user?: string;
    tmpdir?: string;
  };
}

function xml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    "\"": "&quot;",
  })[character]!);
}

function string(value: string): string {
  return `<string>${xml(value)}</string>`;
}

export function buildUiElementLaunchAgentPlist(
  input: UiElementLaunchAgentInput,
): string {
  const argumentsList = [
    input.nodePath,
    `--env-file=${input.environmentFile}`,
    "--import",
    "tsx",
    input.extractionScript,
    "--provider",
    "kiro",
    "--app",
    input.app,
    "--platform",
    input.platform,
    "--version",
    String(input.versionNumber),
    "--limit",
    String(input.limit),
    "--concurrency",
    String(input.concurrency),
    ...(input.restartOnFailure ? ["--allow-empty"] : []),
    "--output",
    input.reportPath,
  ];
  const environment = [
    ["PATH", input.environment.path],
    ["HOME", input.environment.home],
    ...(input.environment.user ? [["USER", input.environment.user]] : []),
    ...(input.environment.tmpdir ? [["TMPDIR", input.environment.tmpdir]] : []),
  ];
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" "
      + "\"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
    "<plist version=\"1.0\">",
    "<dict>",
    "<key>Label</key>",
    string(input.label),
    "<key>ProgramArguments</key>",
    "<array>",
    ...argumentsList.map(string),
    "</array>",
    "<key>WorkingDirectory</key>",
    string(input.workingDirectory),
    "<key>EnvironmentVariables</key>",
    "<dict>",
    ...environment.flatMap(([key, value]) => [`<key>${key}</key>`, string(value)]),
    "</dict>",
    "<key>RunAtLoad</key>",
    "<true/>",
    "<key>KeepAlive</key>",
    ...(input.restartOnFailure
      ? [
        "<dict>",
        "<key>SuccessfulExit</key>",
        "<false/>",
        "</dict>",
      ]
      : ["<false/>"]),
    "<key>ProcessType</key>",
    "<string>Background</string>",
    "<key>AbandonProcessGroup</key>",
    "<false/>",
    "<key>StandardOutPath</key>",
    string(input.stdoutPath),
    "<key>StandardErrorPath</key>",
    string(input.stderrPath),
    "</dict>",
    "</plist>",
    "",
  ].join("\n");
}
