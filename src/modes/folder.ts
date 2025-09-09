import * as path from "node:path";
import * as tinyglobby from "tinyglobby";
import * as z from "zod";
import { zConfigBase, zVersion } from "../schemas.js";
import type { Mode, Version } from "../types.js";

type VersionFromFolder = Version & { src: string };

const config = z.object({
  mode: z.literal("folder"),
  include: z.array(z.string()).default(["./.versions/*"]),
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

  sortStrategy: zConfigBase.shape.sortStrategy.default("alpha_asc"),
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

  setup: () => () => undefined,
} satisfies Mode<typeof config, VersionFromFolder>;
