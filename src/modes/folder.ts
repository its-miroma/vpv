import * as path from "node:path";
import * as tinyglobby from "tinyglobby";
import * as z from "zod";
import type { Mode, Version } from "../index.ts";
import { zCommonConfig, zVersion } from "../schemas.ts";

const config = z.object({
  /** Discover versions through folders. */
  mode: z.literal("folder"),

  /** Globs that must match filesystem folders. */
  include: z.array(z.string()).default(["./.versions/*"]),

  /** Version associated with the project's root. */
  includeRootAs: z
    .union([zVersion.partial().required({ base: true }), z.null()])
    .default({ base: "/" })
    .transform((v) =>
      v === null
        ? v
        : {
            ...v,
            name: v.name ?? "Root",
            src: v.src ?? process.cwd(),
            date: v.date,
            isLatest: v.isLatest ?? true,
          },
    ),

  sortStrategy: zCommonConfig.shape.sortStrategy.default("alpha_asc"),
});

export default {
  config,

  discover: (config) => [
    ...(config.includeRootAs === null ? [] : [config.includeRootAs]),
    ...[
      ...new Set(tinyglobby.globSync(config.include, { absolute: true, onlyDirectories: true })),
    ].map((p) => ({
      base: `/${path.basename(p)}/`,
      name: path.basename(p),
      src: p,
      date: undefined,
    })),
  ],

  mutator: (s, c, v) => {
    const config = s(c, v);
    config.userConfig.srcExclude = [
      ...(config.userConfig.srcExclude ?? []),
      ...config.versions
        .filter((otherV) => !path.relative(v.src, otherV.src).startsWith(".."))
        .map((otherV) => path.relative(v.src, otherV.src)),
    ];
    return config;
  },

  setup: () => () => undefined,
} satisfies Mode<typeof config, Version & { src: string }>;
