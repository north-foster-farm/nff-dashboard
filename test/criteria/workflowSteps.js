// A small reader for what the D2 criteria ask of a GitHub Actions
// workflow: which events start it, which commands its steps run, and
// whether any step or job is allowed to fail. It knows the shapes GitHub
// documents for `on:` and for `run:` (one line, or a `|` / `>` block).
// A shape it does not know reads as absent, so a test fails rather than
// passes on a workflow nobody checked.

const indentOf = (line) => line.length - line.trimStart().length;
const meaningful = (line) => line.trim() !== "" && !/^\s*#/.test(line);
const stripComment = (text) => text.replace(/\s+#.*$/, "").trim();
const unquote = (text) => text.trim().replace(/^["']|["']$/g, "");

function childLines(lines, start, keyIndent) {
  const block = [];
  for (const line of lines.slice(start + 1)) {
    if (meaningful(line) && indentOf(line) <= keyIndent) break;
    block.push(line);
  }
  return block;
}

// The events named under the top-level `on:` key.
export function triggerEvents(text) {
  const lines = text.split("\n");
  const onIndex = lines.findIndex((line) => /^["']?on["']?:/.test(line));
  if (onIndex === -1) return [];
  const inline = stripComment(lines[onIndex].replace(/^["']?on["']?:/, ""));
  if (inline.startsWith("[")) {
    return inline.slice(1, -1).split(",").map(unquote);
  }
  if (inline) return [unquote(inline)];
  const block = childLines(lines, onIndex, 0).filter(meaningful);
  const eventIndent = Math.min(...block.map(indentOf));
  return block
    .filter((line) => indentOf(line) === eventIndent)
    .map((line) => unquote(line.trim().split(":")[0]));
}

// Every `run:` command in the workflow, a block scalar joined by lines.
export function runCommands(text) {
  const lines = text.split("\n");
  const commands = [];
  lines.forEach((line, index) => {
    const match = /^(\s*(?:-\s+)?)run:\s*(.*)$/.exec(line);
    if (!match) return;
    const value = match[2].trim();
    if (!/^[|>][-+]?$/.test(value)) {
      commands.push(value);
      return;
    }
    const keyIndent = match[1].length;
    commands.push(childLines(lines, index, keyIndent)
      .map((child) => child.trim()).filter(Boolean).join("\n"));
  });
  return commands;
}

// True when some step or job may fail without failing the workflow.
export function allowsFailure(text) {
  return text.split("\n").some((line) =>
    /^\s*(?:-\s+)?continue-on-error:\s*(true|\$\{\{)/.test(line));
}
