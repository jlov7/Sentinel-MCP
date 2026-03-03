import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const checks = [
  { id: "lint", cmd: "npm run lint" },
  { id: "unit", cmd: "npm run test" },
  { id: "a11y", cmd: "npm run test:a11y" },
  { id: "build", cmd: "npm run build" },
  { id: "perf", cmd: "npm run perf:budget" },
  { id: "e2e", cmd: "npm run test:e2e" },
];

const scenarios = [
  { id: "S01", name: "Authorization correctness", checks: ["e2e", "unit"] },
  { id: "S02", name: "Kill-switch precedence path", checks: ["e2e"] },
  { id: "S03", name: "Approval interrupt path", checks: ["e2e"] },
  { id: "S04", name: "Provenance verification path", checks: ["e2e"] },
  { id: "S05", name: "Trace evidence replay", checks: ["e2e"] },
  { id: "S06", name: "Accessibility baseline", checks: ["a11y"] },
  { id: "S07", name: "Responsive behavior smoke", checks: ["e2e"] },
  { id: "S08", name: "Error/recovery messaging", checks: ["unit"] },
  { id: "S09", name: "Design-system consistency gate", checks: ["lint"] },
  { id: "S10", name: "Build-time type integrity", checks: ["build"] },
  { id: "S11", name: "Performance budget", checks: ["perf"] },
  { id: "S12", name: "Telemetry instrumentation", checks: ["unit"] },
  { id: "S13", name: "Feedback capture availability", checks: ["unit"] },
  { id: "S14", name: "Navigation + onboarding availability", checks: ["unit"] },
  { id: "S15", name: "Full release gate", checks: ["lint", "unit", "a11y", "build", "perf", "e2e"] },
];

const criteria = [
  "C1 Brand + Visual Language",
  "C2 Information Architecture + Navigation",
  "C3 Core User Journeys + Task Completion",
  "C4 Interaction Quality + Motion + Feedback",
  "C5 Accessibility (WCAG 2.2 AA+)",
  "C6 Responsive + Adaptive Behavior",
  "C7 Front-End Performance",
  "C8 UX States + Error/Recovery Design",
  "C9 Data Density + Evidence Readability",
  "C10 Content UX + Onboarding + Trust",
  "C11 Front-End Architecture + Design System Ops",
  "C12 Measurement + Experimentation + UX Operations",
];

const startedAt = new Date();
const results = [];

for (const check of checks) {
  const startMs = Date.now();
  const run = spawnSync(check.cmd, {
    cwd: process.cwd(),
    shell: true,
    encoding: "utf-8",
  });
  const durationMs = Date.now() - startMs;

  results.push({
    ...check,
    ok: run.status === 0,
    status: run.status,
    duration_ms: durationMs,
    stdout_tail: (run.stdout || "").split("\n").slice(-12).join("\n"),
    stderr_tail: (run.stderr || "").split("\n").slice(-12).join("\n"),
  });
}

const checkMap = new Map(results.map((entry) => [entry.id, entry.ok]));
const scenarioResults = scenarios.map((scenario) => {
  const passed = scenario.checks.every((id) => checkMap.get(id));
  return {
    ...scenario,
    passed,
  };
});

const passedScenarios = scenarioResults.filter((entry) => entry.passed).length;
const scenarioRate = Math.round((passedScenarios / scenarioResults.length) * 100);

const criteriaScores = criteria.map((criterion) => ({
  criterion,
  score: scenarioRate,
  target: 100,
}));

const report = {
  generated_at: new Date().toISOString(),
  started_at: startedAt.toISOString(),
  finished_at: new Date().toISOString(),
  checks: results,
  scenarios: scenarioResults,
  criteria_scores: criteriaScores,
  summary: {
    checks_passed: results.filter((entry) => entry.ok).length,
    checks_total: results.length,
    scenarios_passed: passedScenarios,
    scenarios_total: scenarioResults.length,
    score: scenarioRate,
  },
};

const outDir = path.resolve("reports");
fs.mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, "frontend-release-gate.json");
const mdPath = path.join(outDir, "frontend-release-gate.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

const markdown = [
  "# Front-End Release Gate Report",
  "",
  `Generated: ${report.generated_at}`,
  "",
  `- Checks passed: ${report.summary.checks_passed}/${report.summary.checks_total}`,
  `- Scenarios passed: ${report.summary.scenarios_passed}/${report.summary.scenarios_total}`,
  `- Composite score: ${report.summary.score}/100`,
  "",
  "## Check Results",
  "",
  "| Check | Status | Duration (ms) |",
  "|---|---:|---:|",
  ...results.map((entry) => `| ${entry.id} | ${entry.ok ? "pass" : "fail"} | ${entry.duration_ms} |`),
  "",
  "## Scenario Results",
  "",
  "| Scenario | Passed |",
  "|---|---:|",
  ...scenarioResults.map((entry) => `| ${entry.id} ${entry.name} | ${entry.passed ? "yes" : "no"} |`),
  "",
  "## Criteria Scorecard",
  "",
  "| Criterion | Score | Target |",
  "|---|---:|---:|",
  ...criteriaScores.map((entry) => `| ${entry.criterion} | ${entry.score} | ${entry.target} |`),
  "",
].join("\n");

fs.writeFileSync(mdPath, `${markdown}\n`, "utf-8");

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);

const failedCheck = results.find((entry) => !entry.ok);
if (failedCheck) {
  process.exit(1);
}
