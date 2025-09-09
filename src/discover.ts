import modes from "./modes/index.js";
import type { Config, Version, Versions } from "./types.js";

export const sortPresets = [
  "alpha_asc",
  "alpha_desc",
  "date_asc",
  "date_desc",
  "num_asc",
  "num_desc",
  "none",
  "random",
] as const;

type SortPreset = (typeof sortPresets)[number];
type SortComparator = (a: Version, b: Version) => number;

function sort(unsorted: Versions, strategy: SortPreset | SortComparator = "none"): Versions {
  try {
    if (typeof strategy === "function") {
      return [...unsorted].sort(strategy) as Versions;
    }

    switch (strategy) {
      case "none":
        return [...unsorted];
      case "random": {
        const sorted: Versions = [...unsorted];
        for (let i = sorted.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [sorted[i], sorted[j]] = [sorted[j]!, sorted[i]!];
        }
        return sorted;
      }
      default: {
        // TODO: define locale for Intl.Collator
        const ascComparators: Record<Extract<SortPreset, `${string}_asc`>, SortComparator> = {
          alpha_asc: (a, b) =>
            new Intl.Collator(undefined, { sensitivity: "base" }).compare(a.base, b.base),
          date_asc: (a, b) =>
            a.date instanceof Date && b.date instanceof Date
              ? a.date.getTime() - b.date.getTime()
              : 0,
          num_asc: (a, b) =>
            new Intl.Collator(undefined, {
              numeric: true,
              sensitivity: "base",
            }).compare(a.base, b.base),
        };

        const comparator = {
          ...ascComparators,
          ...(Object.fromEntries(
            Object.entries(ascComparators).flatMap(([k, v]) => [
              [k.replace(/_asc$/, "_desc"), ((a, b) => v(b, a)) as typeof v],
            ]),
          ) as Record<Extract<SortPreset, `${string}_desc`>, SortComparator>),
        }[strategy];

        return [...unsorted].sort(comparator) as Versions;
      }
    }
  } catch (error) {
    throw new Error("failed to sort versions.", { cause: error });
  }
}

export default async (config: Config): Promise<Versions> => {
  const unsorted = await modes[config.mode].discover(config as never);
  if (!unsorted.length) {
    throw new Error("no versions discovered.");
  }

  // TODO: is this needed?
  for (const v of unsorted) {
    let base = v.base;
    if (!base.startsWith("/")) {
      base = `/${base}`;
    }
    if (!base.endsWith("/")) {
      base = `${base}/`;
    }
    if (base === "/./") {
      base = "/";
    }
    v.base = base;
  }

  const versions = sort(unsorted as Versions, config.sortStrategy);

  const presetBaseLogic = (versions: Versions) =>
    versions.find((v) => v.base === "/") === undefined ? versions[0].base : "/";

  const latestBase =
    typeof config.latestVersion === "string"
      ? config.latestVersion
      : config.latestVersion?.(versions) ?? presetBaseLogic(versions);
  if (!versions.some((v) => v.base === latestBase)) {
    throw new Error(`latestVersion "${latestBase}" not found.`);
  }

  const defaultBase =
    typeof config.defaultVersion === "string"
      ? config.defaultVersion
      : config.defaultVersion?.(versions) ?? presetBaseLogic(versions);
  if (!versions.some((v) => v.base === defaultBase)) {
    throw new Error(`defaultVersion "${defaultBase}" not found.`);
  }

  for (const v of versions) {
    if (v.base === latestBase) {
      v.isLatest = true;
    }
    if (v.base === defaultBase) {
      v.base = "/";
    }
  }

  const seen = new Set<string>();
  for (const v of versions) {
    if (seen.has(v.base)) {
      throw new Error(`discovered multiple versions with "${v.base}".`);
    }
    seen.add(v.base);
  }

  return versions;
};
