#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const UNSUPPORTED_MACROS = [
  { pattern: /\\oiiint(?![A-Za-z])/g, replacement: "∰", name: "\\oiiint" },
  { pattern: /\\oiint(?![A-Za-z])/g, replacement: "∯", name: "\\oiint" },
];

function usage() {
  return `Usage:
  node md_math_cleanup.js [--check|--write] [--aggressive-code-spans] [--json] <md-file-or-dir>...

Options:
  --check                  Scan only. This is the default.
  --write                  Rewrite files in place.
  --aggressive-code-spans  Convert most non-source inline code spans to math.
  --json                   Print machine-readable JSON report.
  --help                   Show this help.
`;
}

function parseArgs(argv) {
  const opts = {
    mode: "check",
    aggressiveCodeSpans: false,
    json: false,
    paths: [],
  };

  for (const arg of argv) {
    if (arg === "--check") opts.mode = "check";
    else if (arg === "--write") opts.mode = "write";
    else if (arg === "--aggressive-code-spans") opts.aggressiveCodeSpans = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else opts.paths.push(arg);
  }
  return opts;
}

function collectMarkdownFiles(targets) {
  const files = [];
  const seen = new Set();

  function visit(target) {
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Path not found: ${target}`);
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(resolved)) {
        if (entry === "node_modules" || entry === ".git") continue;
        visit(path.join(resolved, entry));
      }
      return;
    }
    if (stat.isFile() && resolved.endsWith(".md") && !seen.has(resolved)) {
      seen.add(resolved);
      files.push(resolved);
    }
  }

  for (const target of targets) visit(target);
  return files.sort();
}

function keepInlineCode(raw) {
  const value = raw.trim();
  if (!value) return true;
  if (/\.pdf$/i.test(value)) return true;
  if (/^\d{8}$/.test(value)) return true;
  if (/^https?:\/\//i.test(value)) return true;
  if (/\.(md|js|ts|tsx|jsx|json|py|sh|yml|yaml|toml|lock)$/i.test(value)) return true;
  if (/^(npm|pnpm|yarn|node|python|git|rg|sed|awk|curl|open)\b/.test(value)) return true;
  if (/^--?[a-z0-9][a-z0-9-]*$/i.test(value)) return true;
  return false;
}

function isMathishInlineCode(raw) {
  const value = raw.trim();
  if (!value || keepInlineCode(value)) return false;
  if (/\\[a-zA-Z]+/.test(value)) return true;
  if (/[=^_<>]/.test(value)) return true;
  if (/[∫ΣΔθλμρπωβφΩτν≤≥≈≠±×·∞→]/.test(value)) return true;
  if (/\b(sin|cos|tan|sqrt|lambda|theta|omega|beta|mu|rho|pi|Delta|Sigma|integral|prop|varphi|alpha|nu|phi)\b/.test(value)) return true;
  if (/^[A-Za-z][A-Za-z0-9']{0,3}$/.test(value)) return true;
  if (/^\d+(\.\d+)?\s*[A-Za-z/%]+$/.test(value)) return true;
  return false;
}

function replaceBareWord(text, word, replacement) {
  const pattern = new RegExp(`(^|[^\\\\])\\b${word}\\b`, "g");
  return text.replace(pattern, (match, prefix) => `${prefix}${replacement}`);
}

function normalizeFormula(raw) {
  let out = raw.trim();

  out = normalizeDoubleBackslashCommands(out);
  out = out.replace(/([一-龥]+)/g, "\\text{$1}");

  const unicodeReplacements = [
    [/Δ/g, "\\Delta "],
    [/Σ/g, "\\sum "],
    [/∫/g, "\\int "],
    [/θ/g, "\\theta "],
    [/λ/g, "\\lambda "],
    [/μ/g, "\\mu "],
    [/ρ/g, "\\rho "],
    [/π/g, "\\pi "],
    [/ω/g, "\\omega "],
    [/β/g, "\\beta "],
    [/φ/g, "\\phi "],
    [/Ω/g, "\\Omega "],
    [/τ/g, "\\tau "],
    [/ν/g, "\\nu "],
    [/≤/g, "\\le "],
    [/≥/g, "\\ge "],
    [/≈/g, "\\approx "],
    [/≠/g, "\\ne "],
    [/±/g, "\\pm "],
    [/×/g, "\\times "],
    [/·/g, "\\cdot "],
    [/∞/g, "\\infty "],
    [/→/g, "\\to "],
  ];
  for (const [pattern, replacement] of unicodeReplacements) {
    out = out.replace(pattern, replacement);
  }

  out = out.replace(/->/g, "\\to ");
  out = out.replace(/~/g, "\\sim ");
  out = out.replace(/\bsqrt\(([^()]*)\)/g, "\\sqrt{$1}");
  const bareWordReplacements = [
    ["sin", "\\sin"],
    ["cos", "\\cos"],
    ["tan", "\\tan"],
    ["lambda", "\\lambda"],
    ["theta", "\\theta"],
    ["omega", "\\omega"],
    ["beta", "\\beta"],
    ["varphi", "\\varphi"],
    ["phi", "\\phi"],
    ["alpha", "\\alpha"],
    ["nu", "\\nu"],
    ["rho", "\\rho"],
    ["mu", "\\mu"],
    ["pi", "\\pi"],
    ["Delta", "\\Delta"],
    ["Sigma", "\\Sigma"],
    ["integral", "\\int"],
    ["prop", "\\propto"],
    ["minus", "-"],
  ];
  for (const [word, replacement] of bareWordReplacements) {
    out = replaceBareWord(out, word, replacement);
  }
  out = out.replace(/([A-Za-z0-9)}\]])\^(-\d+)/g, "$1^{$2}");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function replaceUnsupportedMacros(line) {
  let next = line;
  for (const macro of UNSUPPORTED_MACROS) {
    next = next.replace(macro.pattern, macro.replacement);
  }
  return next;
}

function normalizeDoubleBackslashCommands(line) {
  return line.replace(/\\\\([A-Za-z])/g, "\\$1");
}

function convertLegacyDelimiters(line) {
  return line
    .replace(/\\\[/g, () => "$$")
    .replace(/\\\]/g, () => "$$")
    .replace(/\\\(/g, () => "$")
    .replace(/\\\)/g, () => "$");
}

function convertInlineCode(line, options) {
  return line.replace(/`([^`]+)`/g, (match, raw) => {
    if (keepInlineCode(raw)) return match;
    if (options.aggressiveCodeSpans || isMathishInlineCode(raw)) {
      return `$${normalizeFormula(raw)}$`;
    }
    return match;
  });
}

function isUnescapedInlineDollar(line, index) {
  return (
    line[index] === "$" &&
    line[index - 1] !== "\\" &&
    line[index - 1] !== "$" &&
    line[index + 1] !== "$"
  );
}

function normalizeSpacedInlineMath(line) {
  let out = "";
  let i = 0;
  let inInlineCode = false;

  while (i < line.length) {
    if (line[i] === "`") {
      inInlineCode = !inInlineCode;
      out += line[i];
      i++;
      continue;
    }

    if (!inInlineCode && isUnescapedInlineDollar(line, i)) {
      let end = -1;
      for (let j = i + 1; j < line.length; j++) {
        if (isUnescapedInlineDollar(line, j)) {
          end = j;
          break;
        }
      }

      if (end >= 0) {
        const formula = line.slice(i + 1, end);
        const trimmed = formula.trim();
        out += trimmed ? `$${trimmed}$` : `$${formula}$`;
        i = end + 1;
        continue;
      }
    }

    out += line[i];
    i++;
  }

  return out;
}

function normalizeIndentedDisplayMath(lines) {
  const result = [...lines];
  for (let i = 0; i < result.length; i++) {
    const open = result[i].match(/^( {4,})\$\$\s*$/);
    if (!open) continue;

    const indentWidth = open[1].length;
    result[i] = "$$";

    for (let j = i + 1; j < result.length; j++) {
      if (/^\s*\$\$\s*$/.test(result[j])) {
        result[j] = "$$";
        i = j;
        break;
      }
      const leading = result[j].match(/^ */)[0].length;
      if (leading >= indentWidth) {
        result[j] = result[j].slice(indentWidth);
      }
    }
  }
  return result;
}

function processMarkdown(text, options) {
  const lines = text.split(/\r?\n/);
  let inFence = false;
  const processed = lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    let next = line;
    next = convertInlineCode(next, options);
    next = convertLegacyDelimiters(next);
    next = replaceUnsupportedMacros(next);
    next = normalizeDoubleBackslashCommands(next);
    next = normalizeSpacedInlineMath(next);
    return next;
  });

  return normalizeIndentedDisplayMath(processed).join("\n");
}

function stripInlineCode(line, state) {
  if (/^\s*(```|~~~)/.test(line)) {
    return { line: "", inFence: !state.inFence };
  }
  if (state.inFence) return { line: "", inFence: state.inFence };

  let out = "";
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "`") {
      inCode = !inCode;
      out += " ";
    } else {
      out += inCode ? " " : line[i];
    }
  }
  return { line: out, inFence: state.inFence };
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function extractMath(text) {
  const lines = text.split(/\r?\n/);
  let clean = "";
  let state = { inFence: false };
  for (const raw of lines) {
    const stripped = stripInlineCode(raw, state);
    state = { inFence: stripped.inFence };
    clean += stripped.line + "\n";
  }

  const items = [];
  for (let i = 0; i < clean.length;) {
    if (clean[i] === "$" && clean[i - 1] !== "\\") {
      if (clean[i + 1] === "$") {
        const start = i;
        const end = clean.indexOf("$$", i + 2);
        if (end < 0) {
          items.push({ type: "unclosed", delimiter: "$$", formula: clean.slice(i + 2), line: lineOf(clean, start) });
          break;
        }
        items.push({ type: "math", delimiter: "$$", display: true, formula: clean.slice(i + 2, end), line: lineOf(clean, start) });
        i = end + 2;
        continue;
      }

      let end = -1;
      for (let j = i + 1; j < clean.length && clean[j] !== "\n"; j++) {
        if (clean[j] === "$" && clean[j - 1] !== "\\") {
          end = j;
          break;
        }
      }
      if (end >= 0) {
        items.push({ type: "math", delimiter: "$", display: false, formula: clean.slice(i + 1, end), line: lineOf(clean, i) });
        i = end + 1;
        continue;
      }
    }
    i++;
  }
  return items;
}

function inspectMarkdown(text) {
  const issues = [];
  let unexpectedCodeSpans = 0;

  let inFence = false;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (/\\[()[\]]/.test(line)) {
      issues.push({ line: i + 1, type: "legacy-delimiter", text: line.trim() });
    }
    if (/^ {4,}\$\$\s*$/.test(line)) {
      issues.push({ line: i + 1, type: "indented-display-math", text: line.trim() });
    }

    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const raw = match[1];
      if (!keepInlineCode(raw) && isMathishInlineCode(raw)) {
        unexpectedCodeSpans++;
        issues.push({ line: i + 1, type: "math-inline-code", text: raw });
      }
    }
  }

  let mathExpressions = 0;
  for (const item of extractMath(text)) {
    if (item.type === "unclosed") {
      issues.push({ line: item.line, type: "unclosed-math", text: item.delimiter });
      continue;
    }
    mathExpressions++;
    const rawFormula = item.formula;
    if (!item.display && rawFormula !== rawFormula.trim()) {
      issues.push({ line: item.line, type: "spaced-inline-math", text: `$${rawFormula}$` });
    }

    const formula = rawFormula.trim();
    if (!formula) {
      issues.push({ line: item.line, type: "empty-math", text: item.delimiter });
      continue;
    }
    for (const macro of UNSUPPORTED_MACROS) {
      if (macro.pattern.test(formula)) {
        issues.push({ line: item.line, type: "unsupported-obsidian-macro", text: macro.name });
      }
      macro.pattern.lastIndex = 0;
    }
    if (/\\\\[A-Za-z]+/.test(formula)) {
      issues.push({ line: item.line, type: "double-backslash-command", text: formula.slice(0, 160) });
    }
  }

  return { issues, mathExpressions, unexpectedCodeSpans };
}

function run(opts) {
  if (opts.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!opts.paths.length) {
    process.stderr.write(usage());
    return 2;
  }

  const files = collectMarkdownFiles(opts.paths);
  const report = {
    mode: opts.mode,
    files: files.length,
    changedFiles: 0,
    mathExpressions: 0,
    issues: [],
    fileReports: [],
  };

  for (const file of files) {
    const before = fs.readFileSync(file, "utf8");
    let current = before;
    if (opts.mode === "write") {
      current = processMarkdown(before, opts);
      if (current !== before) {
        fs.writeFileSync(file, current);
        report.changedFiles++;
      }
    }

    const inspection = inspectMarkdown(current);
    report.mathExpressions += inspection.mathExpressions;
    report.fileReports.push({
      file,
      changed: current !== before,
      mathExpressions: inspection.mathExpressions,
      issues: inspection.issues,
    });
    for (const issue of inspection.issues) {
      report.issues.push({ file, ...issue });
    }
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`mode=${report.mode}`);
    console.log(`files=${report.files}`);
    console.log(`changedFiles=${report.changedFiles}`);
    console.log(`mathExpressions=${report.mathExpressions}`);
    console.log(`issues=${report.issues.length}`);
    for (const issue of report.issues.slice(0, 80)) {
      console.log(`${issue.file}:${issue.line}: ${issue.type}: ${issue.text}`);
    }
    if (report.issues.length > 80) {
      console.log(`... ${report.issues.length - 80} more`);
    }
  }

  return report.issues.length ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = run(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

module.exports = {
  collectMarkdownFiles,
  inspectMarkdown,
  normalizeFormula,
  normalizeSpacedInlineMath,
  processMarkdown,
};
