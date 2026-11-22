// The one way a criteria test may run git (nff-dashboard#99). A sandbox
// test once ran inside a pre-commit hook, inherited the hook's GIT_DIR
// and GIT_INDEX_FILE, and pushed fixture commits to the real origin.
// Four layers keep that from happening again:
//
// 1. Refuse to load at all when the process starts with a GIT_*
//    variable other than GIT_EDITOR: a hook or another git command is
//    running us, and nothing here should run in that context. (The
//    decoy self-test, sandboxGit.test.js, sets them only after load,
//    to prove layers 2 to 4 hold even so.)
// 2. Run git with every GIT_* variable removed, no global or system
//    config, no prompts, and a ceiling at the sandbox root, so git can
//    find no repository but the sandbox's own.
// 3. Tell git to refuse every transport but local paths, and clear any
//    credential helper. A push to GitHub fails inside git itself, for
//    git run by this file and by anything it starts (bin/promote, the
//    hooks, the check scripts), since they inherit the same env.
// 4. Before a push, a promote or a hook run, check that the git dir,
//    the common dir, origin and every push URL resolve inside the
//    sandbox root, and refuse otherwise; refuse a temp folder that sits
//    inside a repository. Each sandbox prints its git dir and origin.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

const ALLOWED_AT_START = new Set(["GIT_EDITOR"]);

export function strayGitVariables(env) {
  return Object.keys(env).filter((name) =>
    name.startsWith("GIT_") && !ALLOWED_AT_START.has(name));
}

const strayAtStart = strayGitVariables(process.env);
if (strayAtStart.length > 0) {
  throw new Error(
    `test/criteria refuses to run with ${strayAtStart.join(", ")} set: ` +
    "it is being run from inside git (a hook?), where its sandboxes " +
    "could reach the real repository (#99). Run it from a plain shell.");
}

const IDENTITY = {
  GIT_AUTHOR_NAME: "Criteria Test",
  GIT_AUTHOR_EMAIL: "criteria@example.invalid",
  GIT_COMMITTER_NAME: "Criteria Test",
  GIT_COMMITTER_EMAIL: "criteria@example.invalid",
};

// Config passed through the environment, so every git started under
// this env (however deep) gets it.
const LOCAL_TRANSPORT_ONLY = [
  ["protocol.allow", "never"],
  ["protocol.file.allow", "always"],
  ["credential.helper", ""],
];

function withoutGitVariables(env) {
  return Object.fromEntries(Object.entries(env)
    .filter(([name]) => !name.startsWith("GIT_")));
}

function configEnv(pairs) {
  const env = { GIT_CONFIG_COUNT: String(pairs.length) };
  pairs.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key;
    env[`GIT_CONFIG_VALUE_${index}`] = value;
  });
  return env;
}

export function sandboxEnv(root) {
  return {
    ...withoutGitVariables(process.env),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    GIT_CEILING_DIRECTORIES: root,
    ...IDENTITY,
    ...configEnv(LOCAL_TRANSPORT_ONLY),
  };
}

const isInside = (root, path) => path.startsWith(`${root}${sep}`);

function realOrSelf(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

// A temp folder inside a repository would put that repository above
// every sandbox. Asked without the ceiling, which would hide it.
function refuseTempInsideARepository(temp) {
  const env = {
    ...withoutGitVariables(process.env),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
  };
  const probe = spawnSync("git", ["rev-parse", "--absolute-git-dir"],
    { cwd: temp, env, stdio: "pipe" });
  if (probe.status === 0) {
    throw new Error(`refusing: the temp folder ${temp} is inside the ` +
      `git repository at ${`${probe.stdout}`.trim()} (#99)`);
  }
}

// A fresh folder under the system temp folder, with git, spawn and the
// containment check bound to it.
export function makeSandboxRoot(prefix) {
  const temp = realpathSync(tmpdir());
  refuseTempInsideARepository(temp);
  const root = realpathSync(mkdtempSync(join(temp, prefix)));
  if (!isInside(temp, root)) {
    throw new Error(`sandbox root ${root} is not under ${temp}`);
  }
  const env = sandboxEnv(root);
  const spawn = (command, args, cwd, timeout = 60_000) => {
    const result = spawnSync(command, args,
      { cwd, env, stdio: "pipe", timeout });
    return {
      exitCode: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  };
  const git = (cwd, ...args) =>
    execFileSync("git", args, { cwd, env, stdio: "pipe" }).toString().trim();
  // Every path git would act on or push to, for a clone: its git dir,
  // its common dir (a worktree's real repository), origin's fetch URL
  // and every push URL.
  const pathsOf = (clone) => [
    ["git dir", git(clone, "rev-parse", "--absolute-git-dir")],
    ["common dir", git(clone, "rev-parse", "--path-format=absolute",
      "--git-common-dir")],
    ["origin", git(clone, "remote", "get-url", "origin")],
    ...git(clone, "remote", "get-url", "--push", "--all", "origin")
      .split("\n").map((url) => ["origin push URL", url]),
  ];
  const assertContained = (clone) => {
    const paths = pathsOf(clone).map(([what, path]) =>
      [what, realOrSelf(path)]);
    for (const [what, path] of paths) {
      if (!isInside(root, path)) {
        throw new Error(`refusing: the sandbox's ${what} is ${path}, ` +
          `outside its root ${root} (#99)`);
      }
    }
    return Object.fromEntries(paths);
  };
  const announce = (clone) => {
    const paths = assertContained(clone);
    console.log(`sandbox: git dir ${paths["git dir"]}, ` +
      `origin ${paths.origin}`);
  };
  return {
    root,
    env,
    git,
    spawn,
    assertContained,
    announce,
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
}
