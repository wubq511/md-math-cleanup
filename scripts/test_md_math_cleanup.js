#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const skillDir = path.resolve(__dirname, "..");
const cleaner = path.join(__dirname, "md_math_cleanup.js");
const fixture = path.join(skillDir, "tests", "fixtures", "broken.md");
const expected = path.join(skillDir, "tests", "expected", "fixed.md");

function run(args, options = {}) {
  try {
    return childProcess.execFileSync(process.execPath, [cleaner, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (options.allowFailure && error.stdout) {
      return error.stdout;
    }
    throw error;
  }
}

function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "md-math-cleanup-test-"));
  const target = path.join(tmpDir, "sample.md");
  fs.copyFileSync(fixture, target);

  const initialReport = JSON.parse(run(["--check", "--json", target], { allowFailure: true }));
  if (!initialReport.issues.some((issue) => issue.type === "spaced-inline-math")) {
    throw new Error("expected fixture to report spaced-inline-math before cleanup");
  }

  const writeReport = JSON.parse(run(["--write", "--aggressive-code-spans", "--json", target]));
  if (writeReport.issues.length !== 0) {
    throw new Error(`write left ${writeReport.issues.length} issue(s)`);
  }
  if (writeReport.changedFiles !== 1) {
    throw new Error(`expected changedFiles=1, got ${writeReport.changedFiles}`);
  }

  const actualText = fs.readFileSync(target, "utf8");
  const expectedText = fs.readFileSync(expected, "utf8");
  if (actualText !== expectedText) {
    throw new Error(`fixed output mismatch\n--- actual ---\n${actualText}\n--- expected ---\n${expectedText}`);
  }

  const checkReport = JSON.parse(run(["--check", "--json", target]));
  if (checkReport.issues.length !== 0) {
    throw new Error(`check found ${checkReport.issues.length} issue(s) after cleanup`);
  }
  if (checkReport.mathExpressions !== 8) {
    throw new Error(`expected mathExpressions=8, got ${checkReport.mathExpressions}`);
  }

  console.log("md-math-cleanup tests passed");
}

main();
