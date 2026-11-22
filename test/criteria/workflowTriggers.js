// A small reader for the one question the branch-flow criteria ask of a
// GitHub Actions workflow: does a push to a given branch start it? It
// reads only the top-level `on:` key, in the shapes GitHub documents
// (`on: push`, `on: [push, ...]`, and the mapping form with `branches`,
// `branches-ignore`, `paths` and `paths-ignore` under `push`). A shape
// it does not know reads as "no", so the test fails rather than passes
// on a trigger nobody checked.

const indentOf = (line) => line.length - line.trimStart().length;
const meaningful = (line) => line.trim() !== "" && !/^\s*#/.test(line);
const stripComment = (text) => text.replace(/\s+#.*$/, "").trim();

function blockAfter(lines, start) {
  const parentIndent = indentOf(lines[start]);
  const block = [];
  for (const line of lines.slice(start + 1)) {
    if (meaningful(line) && indentOf(line) <= parentIndent) break;
    if (meaningful(line)) block.push(line);
  }
  return block;
}

function listValue(lines, keyIndex) {
  const inline = stripComment(lines[keyIndex].split(":").slice(1).join(":"));
  if (inline.startsWith("[")) {
    return inline.slice(1, -1).split(",").map(unquote).filter(Boolean);
  }
  return blockAfter(lines, keyIndex)
    .filter((line) => line.trim().startsWith("- "))
    .map((line) => unquote(stripComment(line.trim().slice(2))));
}

function unquote(text) {
  return text.trim().replace(/^["']|["']$/g, "");
}

function globMatches(pattern, branch) {
  const source = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u2042")
    .replace(/\*/g, "[^/]*")
    .replace(/\u2042/g, ".*");
  return new RegExp(`^${source}$`).test(branch);
}

function filtersAllow(pushLines, branch) {
  const keyAt = (key) =>
    pushLines.findIndex((line) => line.trim().startsWith(`${key}:`));
  if (keyAt("paths") !== -1 || keyAt("paths-ignore") !== -1) return false;
  const only = keyAt("branches");
  if (only !== -1) {
    return listValue(pushLines, only).some((p) => globMatches(p, branch));
  }
  const ignore = keyAt("branches-ignore");
  if (ignore !== -1) {
    return !listValue(pushLines, ignore).some((p) => globMatches(p, branch));
  }
  return true;
}

function inlineTriggerNames(value) {
  const bare = stripComment(value);
  if (bare.startsWith("[")) return bare.slice(1, -1).split(",").map(unquote);
  return [unquote(bare)];
}

// True when a push to `branch` starts the workflow whose YAML is `text`.
export function pushStartsWorkflow(text, branch) {
  const lines = text.split("\n");
  const onIndex = lines.findIndex((line) => /^["']?on["']?:/.test(line));
  if (onIndex === -1) return false;
  const inline = stripComment(lines[onIndex].replace(/^["']?on["']?:/, ""));
  if (inline) return inlineTriggerNames(inline).includes("push");
  const onLines = [lines[onIndex], ...blockAfter(lines, onIndex)];
  const pushIndex = onLines.findIndex((line) => /^\s+push:/.test(line));
  if (pushIndex === -1) return false;
  const pushValue = stripComment(onLines[pushIndex].split(":")[1] ?? "");
  if (pushValue && pushValue !== "{}" && pushValue !== "null") return false;
  const pushLines = [onLines[pushIndex], ...blockAfter(onLines, pushIndex)];
  return filtersAllow(pushLines, branch);
}
