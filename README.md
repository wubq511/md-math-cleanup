# md-math-cleanup

`md-math-cleanup` 是一个 Codex skill，用来检查并修复 Markdown 文档里的数学公式，让物理/数学笔记在 Obsidian 中更稳定地渲染成接近课本印刷公式的效果。

它最初用于处理课堂 PDF 转写后的普通物理复习笔记，重点解决公式被误写成 inline code、LaTeX 分隔符不兼容、Obsidian/KaTeX 不支持的宏等问题。

## 能修复的问题

| 问题 | 处理方式 |
| --- | --- |
| `` `\boldsymbol{B}` `` 被 Obsidian 显示成灰底代码 | 转成 `$\boldsymbol{B}$` |
| `` `M=Iβ` `` 这类反引号里的公式 | 转成 `$M=I\beta$` |
| `\(...\)` | 转成 `$...$` |
| `\[...\]` | 转成 `$$...$$` |
| `\oiint` | 转成 Obsidian 更稳定的 `∯` |
| `\oiiint` | 转成 `∰` |
| `\\Delta`、`\\mu` 等双反斜杠 | 归一化成 `\Delta`、`\mu` |
| 四空格缩进的 `$$` display math | 取消缩进，避免被 Markdown 当成代码块 |

脚本会保留常见的非公式 inline code，例如 PDF 来源标记 `` `Chapter9 磁场 20260512.pdf` ``、日期 `` `20260512` ``、命令片段和源码文件名。

## 安装

把仓库放到 Codex skills 目录下：

```bash
git clone https://github.com/wubq511/md-math-cleanup.git ~/.codex/skills/md-math-cleanup
```

之后在 Codex 里可以直接说：

```text
使用 md-math-cleanup 检查并修复 <md 文件或目录>
```

## CLI 用法

这个 skill 自带一个零依赖 Node.js 脚本，可以单独运行。

只检查，不修改文件：

```bash
node ~/.codex/skills/md-math-cleanup/scripts/md_math_cleanup.js --check --json <md-file-or-dir>
```

修复文件：

```bash
node ~/.codex/skills/md-math-cleanup/scripts/md_math_cleanup.js --write --aggressive-code-spans --json <md-file-or-dir>
```

参数：

```text
--check                  只扫描，这是默认模式
--write                  原地改写文件
--aggressive-code-spans  把大多数非源码类 inline code 转成数学公式
--json                   输出 JSON 报告
```

## 推荐工作流

1. 先运行 `--check --json`，确认还有哪些 Obsidian 公式渲染风险。
2. 如果目标是物理/数学笔记，运行 `--write --aggressive-code-spans --json`。
3. 再运行一次 `--check --json`，确保 `issues` 为 `[]`。
4. 打开 Obsidian 抽查公式密集区域，重点看截图里常见的灰底代码、红色宏、display math 缩进问题。

## 验证

仓库内置了 fixture 测试：

```bash
node scripts/test_md_math_cleanup.js
```

预期输出：

```text
md-math-cleanup tests passed
```

也可以对真实 Markdown 目录做只读扫描：

```bash
node scripts/md_math_cleanup.js --check --json /path/to/markdown-notes
```

## 文件结构

```text
.
├── SKILL.md
├── evals/
│   └── evals.json
├── scripts/
│   ├── md_math_cleanup.js
│   └── test_md_math_cleanup.js
└── tests/
    ├── expected/
    │   └── fixed.md
    └── fixtures/
        └── broken.md
```

## 边界

这个工具面向 Markdown/Obsidian 公式清理，不是完整的 LaTeX 语义校对器。自动修复后仍建议抽查高密度公式段，尤其是源文档本身 OCR 或转写就有内容错误的情况。
