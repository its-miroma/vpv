import modes from "./modes/index.js";
import type { Config, Version } from "./types.js";

type Versions = [Version, ...Version[]];

type SortComparator = (a: Version, b: Version) => number;
const isVersions = (versions: Version[]): versions is Versions => versions.length > 0;

const verseableSortPresets = ["alpha", "date", "num"] as const;
const versedSortPresets = verseableSortPresets.flatMap((p) => [`${p}_asc`, `${p}_desc`] as const);
export const sortPresets = ["none", "random", ...versedSortPresets] as const;

export default (config: Config) => {
  const unsorted = modes[config.mode]
    .discover(config as never)
    .filter(
      (v) =>
        !config.exclude.some(
          (e) => (typeof e === "string" && e === v.base) || (e instanceof RegExp && e.test(v.base)),
        ),
    );

  if (!isVersions(unsorted)) {
    throw new Error("no versions discovered.");
  }

  // sort versions
  const alphaCollator = new Intl.Collator(undefined, { sensitivity: "base" });
  const numericCollator = new Intl.Collator(undefined, { numeric: true });
  const versions = (() => {
    try {
      if (typeof config.sortStrategy === "function") {
        return [...unsorted].sort(config.sortStrategy);
      }

      switch (config.sortStrategy) {
        case "none":
          return [...unsorted];
        case "random": {
          const sorted = [...unsorted];
          for (let i = sorted.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Fisher-Yates
            [sorted[i], sorted[j]] = [sorted[j]!, sorted[i]!];
          }
          return sorted;
        }
        default: {
          const baseComparators: Record<(typeof verseableSortPresets)[number], SortComparator> = {
            alpha: (a, b) => alphaCollator.compare(a.base, b.base),
            date: (a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0),
            num: (a, b) => numericCollator.compare(a.base, b.base),
          };

          const comparators = verseableSortPresets.reduce(
            (comparators, p) => {
              const wrapped: SortComparator = (a, b) =>
                a.base === "/" ? 1 : b.base === "/" ? -1 : baseComparators[p](a, b);
              comparators[`${p}_asc`] = (a, b) => wrapped(a, b);
              comparators[`${p}_desc`] = (a, b) => wrapped(b, a);
              return comparators;
            },
            {} as Record<(typeof versedSortPresets)[number], SortComparator>,
          );

          return [...unsorted].sort(comparators[config.sortStrategy]);
        }
      }
    } catch (cause) {
      throw new Error("failed to sort versions.", { cause });
    }
  })() as Versions;

  // find base of latest version
  const latestBase =
    typeof config.latestVersion === "string"
      ? config.latestVersion
      : (config.latestVersion?.(versions)
        ?? versions.find((v) => v.isLatest)?.base
        ?? versions[0].base);
  if (!versions.some((v) => v.base === latestBase)) {
    throw new Error(`latest version '${latestBase}' not discovered.`);
  }

  // find base of default version
  const defaultBase =
    typeof config.defaultVersion === "string"
      ? config.defaultVersion
      : (config.defaultVersion?.(versions)
        ?? versions.find((v) => v.base === "/")?.base
        ?? latestBase);
  if (!versions.some((v) => v.base === defaultBase)) {
    throw new Error(`default version '${defaultBase}' not discovered.`);
  }

  // set fields for default and latest versions
  const baseToVersionsMap = new Map<string, Versions>();
  for (const v of versions) {
    if (v.base === latestBase) {
      v.isLatest = true;
    }

    if (v.base === defaultBase) {
      v.base = "/";
    }

    if (!baseToVersionsMap.has(v.base)) {
      baseToVersionsMap.set(v.base, [v]);
    } else {
      baseToVersionsMap.get(v.base)?.push(v);
    }
  }

  // verify uniqueness of bases
  const baseErrors = [];
  for (const [base, versions] of baseToVersionsMap.entries()) {
    if (versions.length > 1) {
      baseErrors.push(
        new Error(
          [
            `'${base}' is used by ${String(versions.length)} versions:`,
            ...versions.map((v) => `- ${v.name}`),
          ].join("\n"),
        ),
      );
    }
  }

  if (baseErrors.length > 0) {
    throw new AggregateError(baseErrors, "discovered versions with duplicate bases.");
  }

  return versions;
};
