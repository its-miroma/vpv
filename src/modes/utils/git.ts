import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import type { Version } from "../../types.js";

async function git(...args: [string, ...string[]]): Promise<string> {
  // TODO: convert to async, use timeout
  const result = spawnSync("git", args, {
    encoding: null,
    maxBuffer: 1024 * 1024 * 256,
  });
  if (result.status !== 0) {
    throw new Error(`"git ${args.join(" ")}" failed with code ${String(result.status)}.`, {
      cause: new Error(result.stderr.toString()),
    });
  }
  return Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : String(result.stdout);
}

const defaultQueries = {
  full_name: "refname",
  name: "refname:lstrip=2",
  hash: "objectname",
} as const;

export type RefData<T extends string> = {
  -readonly [k in keyof typeof defaultQueries]: string;
} & {
  git: Record<T, string | null>;
};

/** Query git for-each-ref for data from refs matching globs.
 *
 * @param queries Map of desired key to git for-each-ref placeholder
 * @param refs Globs accepted by git for-each-ref
 *
 * @see {@link https://git-scm.com/docs/git-for-each-ref#_field_names} for supported fields
 */
export async function getRefData<Q extends string>(
  queries: Readonly<Record<Q, string>>,
  refs: string[],
  exclude: (string | RegExp)[] = [],
  srcRoot: string,
): Promise<Version[]> {
  type RefType = RefData<Q>;

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
    // The reason for leading and trailing %00 is that git for-each-ref
    // puts each result in a new line, however separating at new line is
    // not sound because some placeholders may output data containing \n.
    `--format=%00${placeholders.map((q) => `%(${q})`).join("%00")}%00`,
    ...refs,
  ] as const;

  const parts = (await git(...args)).split("\0");

  const refCount = (parts.length - 1) / (1 + placeholders.length);
  if (!Number.isInteger(refCount)) {
    throw new Error(["unexpected output from git. called:", `  git ${args.join(" ")}`].join("\n"));
  }

  // Example of the content of `parts`, given the following:
  // -     dQueries = { name: "refname:lstrip=2", hash: "objectname" }
  // -      queries = { date: "committerdate:iso8601-strict", sha: "objectname" }
  //                  (notice the duplicated "objectname" in queries)
  // -         refs = [ "refs/heads/branch-1", "refs/heads/branch-2" ]
  // -------------------------------------------------------------------------------------
  // - placeholders = [ "refname:lstrip=2", "objectname", "committerdate:iso8601-strict" ]
  // -       output =
  //                  \0 branch-1 \0 abc1... \0 2000-01-01T... \0 \n
  //                  \0 branch-2 \0 abc2... \0 2000-01-02T... \0
  // -        parts = [
  //                    "",   "branch-1", "abc1...", "2000-01-01T...",
  //                    "\n", "branch-2", "abc2...", "2000-01-02T...",
  //                    "",
  //                  ]
  // -     refCount = (9 - 1) / (1 + 3) = 2

  const placeholdersIndexMap = Object.fromEntries(placeholders.map((p, i) => [p, i])) as Record<
    (typeof placeholders)[number],
    number
  >;

  const result: RefType[] = [];

  for (let i = 0; i < refCount; i++) {
    const values = parts.slice(
      (1 + placeholders.length) * i + 1,
      (1 + placeholders.length) * (i + 1),
    );

    const record = { git: {} } as RefType;

    for (const k of defaultKeys) {
      // @ts-expect-error the value will be cheched
      record[k] = values[placeholdersIndexMap[defaultQueries[k]]];

      if (!record[k]) {
        throw new Error(`unexpected empty value from git for "${defaultQueries[k]}".`);
      }
    }

    for (const k of Object.keys(queries) as (keyof typeof queries)[]) {
      record.git[k] = values[placeholdersIndexMap[queries[k]]] || null;
    }

    result.push(record);
  }

  return result
    .filter(
      (r) =>
        !defaultKeys.some((k) =>
          exclude.some(
            (e) => (typeof e === "string" && r[k] === e) || (e instanceof RegExp && e.test(r[k])),
          ),
        ),
    )
    .map((r) => ({
      base: r.name,
      src: resolve(srcRoot, r.name),
      data: r,
    }));
}

export async function setup(version: Version) {
  // TODO: maybe ensure clean worktree?
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (typeof version.data?.hash === "string" && typeof version.src === "string") {
    // TODO: check if v.data.hash is checked out
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    await git("worktree", "add", "--detach", version.src, version.data.hash as string);

    return async () => await git("worktree", "remove", "--force", version.src!);
  }

  return async () => null;
}
