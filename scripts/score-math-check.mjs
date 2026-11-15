import assert from "node:assert/strict";
import { formatScore, roundScore, sumRoundedScores } from "../lib/scoreMath.mjs";

assert.equal(roundScore(0.335, 2), 0.34);
assert.equal(roundScore(-1.055, 2), -1.06);
assert.equal(sumRoundedScores([0.335, 0.3, 0.1, 0.3, 0.042]), 1.08);
assert.equal(sumRoundedScores([67 * 0.005, 0.3, 1 * 0.1, 3 * 0.1, 0.042]), 1.08);
assert.equal(roundScore(1.08, 1), 1.1);
assert.equal(formatScore(1.08), "1,1");
assert.equal(formatScore(1.08, 2), "1,08");
assert.equal(formatScore(1.08, 2, true), "+1,08");
assert.equal(formatScore(-1.055, 2, true), "-1,06");

console.log("Score math checks passed.");
