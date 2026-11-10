const { test } = require("node:test");
const assert = require("node:assert/strict");

const { runEval, readBaseline } = require("../eval/runEval");

// The agents' evaluation (eval/cases.js) on rules and trained models: no
// fewer cases may pass than eval/baseline.json records. When more pass,
// raise the baseline with `npm run eval -- --update`.
test("the agents do what at least the baseline's share of real messages ask", async () => {
  const baseline = readBaseline();
  const { results, passed, total } = await runEval();
  const failing = results.filter((result) => !result.pass);
  const newlyFailing = failing.filter((result) => !baseline.failing.some((say) => JSON.stringify(say) === JSON.stringify(result.say)));
  assert.ok(
    passed >= baseline.passed && newlyFailing.length === 0,
    `${passed}/${total} passed (baseline ${baseline.passed}/${baseline.total}). Newly failing:\n${newlyFailing.map((result) => `${JSON.stringify(result.say)}: ${result.problems.join("; ")}`).join("\n")}`
  );
});
