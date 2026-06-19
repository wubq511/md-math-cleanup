---
name: md-math-cleanup
description: Use when the user asks to check or fix Markdown math for Obsidian, especially physics/math notes, formulas showing as gray inline code, red LaTeX commands, broken `$`/`$$` rendering, `\(...\)` or `\[...\]` delimiters, `\oiint`, double backslashes like `\\mu`, or requests to make formulas look like textbook/printed equations.
---

# Markdown Math Cleanup

## Overview

Use this skill to make Markdown study notes render cleanly in Obsidian. The goal is not just "valid LaTeX"; it is Obsidian-readable formulas that look like printed textbook math.

The recurring failure modes are:

- formula text wrapped in backticks, so Obsidian displays it as gray inline code
- `\(...\)` / `\[...\]` delimiters not supported by the user's reader setup
- unsupported or extension-dependent macros such as `\oiint`
- accidental double escaping such as `\\mu`, `\\Delta`, `\\theta`
- display math indented as a Markdown code block

## Workflow

1. Resolve the user's target paths. Accept files or directories; recurse directories for `.md`.
2. Run the bundled scanner first:

   ```bash
   node /Users/robertwu/.codex/skills/md-math-cleanup/scripts/md_math_cleanup.js --check --json <paths...>
   ```

3. If issues are found and the user asked to fix them, run:

   ```bash
   node /Users/robertwu/.codex/skills/md-math-cleanup/scripts/md_math_cleanup.js --write --aggressive-code-spans --json <paths...>
   ```

4. Run the check again after writing. Treat nonzero issues as unfinished work.
5. For high confidence, also run a render check with KaTeX or MathJax when Node/network is available. This catches parse errors, while the bundled scanner catches Obsidian-specific patterns.
6. Report changed files, issue categories fixed, and final counts. If the user showed a screenshot, mention the exact visible symptom that was addressed.

## What The Script Fixes

| Problem | Fix |
| --- | --- |
| `` `\boldsymbol{B}` `` | `$\boldsymbol{B}$` |
| `` `M=Iβ` `` | `$M=I\beta$` |
| `\(...\)` | `$...$` |
| `\[...\]` | `$$...$$` |
| `\oiint` | `∯` |
| `\oiiint` | `∰` |
| `\\Delta`, `\\mu` | `\Delta`, `\mu` |
| four-space-indented `$$` blocks | top-level `$$` blocks |

The script preserves source-file markers such as `` `Chapter9 磁场 20260512.pdf` `` and date markers like `` `20260512` ``.

## Review Rules

After automatic rewriting, inspect representative diffs or line samples:

- formulas should be surrounded by `$` or `$$`, not backticks
- uncommon macros should be replaced with Obsidian-stable equivalents
- physics meaning must remain intact; for example closed surface integrals should keep the closed-integral meaning via `∯`, not silently degrade to ordinary `\iint`
- source references and non-formula code should stay as code

If the target is not a math-heavy note and contains real code snippets, avoid `--aggressive-code-spans` unless the user explicitly wants all inline notation converted.

## Optional Render Check

Use this pattern after the bundled check when you need stronger evidence:

```bash
tmpdir=$(mktemp -d /tmp/obsidian-md-math.XXXXXX)
cd "$tmpdir"
npm init -y >/dev/null 2>&1
npm install katex@0.17.0 markdown-it@14 markdown-it-katex@2 >/dev/null 2>&1
ROOT="<target-dir>" node <<'NODE'
const fs = require("fs");
const path = require("path");
const MarkdownIt = require("markdown-it");
const mdKatex = require("markdown-it-katex");
const md = new MarkdownIt({html: false, linkify: false}).use(mdKatex);
let files = 0, errors = 0, katexNodes = 0;
for (const name of fs.readdirSync(process.env.ROOT).filter(f => f.endsWith(".md"))) {
  files++;
  const html = md.render(fs.readFileSync(path.join(process.env.ROOT, name), "utf8"));
  katexNodes += (html.match(/class="katex/g) || []).length;
  if (html.includes("katex-error")) {
    errors++;
    console.log(`${name}: katex-error`);
  }
}
console.log(`files=${files} renderedKatexNodes=${katexNodes} errors=${errors}`);
process.exitCode = errors ? 1 : 0;
NODE
```

## Report Format

Use concise Chinese by default:

```text
已处理 <path>。
- 修复：<issue category> x <count>
- 涉及文件：<n>
- 验证：issues=0, mathExpressions=<n>, optional render errors=0
```

If anything remains, lead with the remaining issue and the exact file/line.
