import * as childProcess from "node:child_process";
import type { Version } from "../../types.js";

const git = (...args: string[]) => {
  const out = childProcess.spawnSync("git", args, { encoding: "utf8" });

  if (out.error) {
    throw new Error(
      [
        `'git ${args.join(" ")}' failed:`,
        ...out.stderr.split("\n").map((l) => `  ${l}`),
        ...((out.error as NodeJS.ErrnoException).code === "ENOENT"
          ? ["is 'git' installed and in PATH?"]
          : []),
      ].join("\n"),
      { cause: out.error },
    );
  }

  if (out.stderr) {
    console.warn(out.stderr);
  }

  return out;
};

const defaultQueries = {
  fullName: "%(refname)",
  name: "%(refname:short)",
  hash: "%(if)%(*objectname)%(then)%(*objectname)%(else)%(objectname)%(end)",
} as const;

export type RefData<Q extends string> = {
  -readonly [k in keyof typeof defaultQueries]: string;
} & {
  custom: Record<Q, string | null>;
};

// eslint-disable-next-line jsdoc/require-returns -- internal
/**
 * Query git for-each-ref for data from refs matching globs.
 * @param queries Map of desired key to git for-each-ref placeholder
 * @param include Globs accepted by git for-each-ref
 * @see {@link https://git-scm.com/docs/git-for-each-ref#_field_names} for supported fields
 */
export const getRefData = <Q extends string>(
  queries: Record<Q, string>,
  include: string[],
): Version<RefData<Q>>[] => {
  const currentCommit = git("rev-parse", "@").stdout.trim();

  const defaultKeys = Object.keys(defaultQueries) as (keyof typeof defaultQueries)[];

  const placeholders = [
    ...new Set([...Object.values(defaultQueries), ...Object.values(queries)]),
  ] as (
    | (typeof defaultQueries)[keyof typeof defaultQueries]
    | (typeof queries)[keyof typeof queries]
  )[];

  const args = [
    "for-each-ref",
    "--include-root-refs",
    // the reason for leading and trailing %00 is that git for-each-ref
    // puts each result in a new line, however separating at new line is
    // not sound because some placeholders may output data containing \n.
    `--format=%00${placeholders.join("%00")}%00`,
    ...include,
  ] as const;

  const parts = git(...args).stdout.split("\0");

  const refCount = (parts.length - 1) / (1 + placeholders.length);
  if (!Number.isInteger(refCount)) {
    throw new Error(
      [
        "'git for-each-ref' returned unparseable output.",
        "called:",
        `  git ${args.join(" ")}`,
      ].join("\n"),
    );
  }

  // example of the content of `parts`, given the following:
  // -     dQueries = { name: "refname:short", hash: "objectname" }
  // -      queries = { date: "committerdate:iso8601-strict", sha: "objectname" }
  //                  (notice the duplicated "objectname" in queries)
  // -         refs = [ "refs/heads/branch-1", "refs/heads/branch-2" ]
  // -------------------------------------------------------------------------------------
  // - placeholders = [ "refname:short", "objectname", "committerdate:iso8601-strict" ]
  // -       output =
  //                  \0 branch-1 \0 abc1... \0 2000-01-01T... \0 \n
  //                  \0 branch-2 \0 abc2... \0 2000-01-02T... \0
  // -        parts = [
  //                    "",   "branch-1", "abc1...", "2000-01-01T...",
  //                    "\n", "branch-2", "abc2...", "2000-01-02T...",
  //                    "",
  //                  ]
  // -     refCount = (9 - 1) / (1 + 3) = 2

  const placeholdersIndexMap = placeholders.reduce(
    (map, placeholder, index) => {
      map[placeholder] = index;
      return map;
    },
    {} as Record<(typeof placeholders)[number], number>,
  );

  const result: RefData<Q>[] = [];

  for (let i = 0; i < refCount; i++) {
    const values = parts.slice(
      (1 + placeholders.length) * i + 1,
      (1 + placeholders.length) * (i + 1),
    );

    const record = { custom: {} } as RefData<Q>;

    for (const k of defaultKeys) {
      const value = values[placeholdersIndexMap[defaultQueries[k]]];

      if (!value) {
        throw new Error(`got empty value for 'git for-each-ref' query '${defaultQueries[k]}'.`);
      }

      record[k] = value;
    }

    for (const k of Object.keys(queries) as (keyof typeof queries)[]) {
      record.custom[k] = values[placeholdersIndexMap[queries[k]]] || null;
    }

    result.push(record);
  }

  return result.map((r) => ({
    base: `/${r.name}/`,
    name: r.name,
    src: r.hash === currentCommit ? process.cwd() : r.name,
    data: r,
  }));
};

export const hasUncommittedChanges = () =>
  git("status", "--porcelain").stdout.split("\n").filter(Boolean).length > 0;

export const getLastCommitDate = () =>
  new Date(git("log", "--max-count=1", "--pretty=tformat:%aI").stdout);

export const setup = <Q extends string>(version: Version<RefData<Q>>, src: string) => {
  if (src === process.cwd()) {
    return () => undefined;
  }

  git("worktree", "add", "--detach", "--force", src, version.data.hash);
  return () => git("worktree", "remove", "--force", src);
};
