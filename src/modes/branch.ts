import * as z from "zod";
import type { Mode, Version } from "../index.ts";
import { zCommonConfig } from "../schemas.ts";
import * as git from "./utils/git.ts";

const queries = {
  authorDate: "%(authordate:iso8601-strict)",
  committerDate: "%(committerdate:iso8601-strict)",
} as const;

const config = z.object({
  /** Discover versions through Git branches. */
  mode: z.literal("branch"),

  /** Globs that must match Git refs. */
  include: z.array(z.string()).default(["refs/heads/v*"]),

  /** Directory in which branches will be temporarily checked-out. */
  srcDir: z.string().default(".vitepress/.temp/versions"),

  sortStrategy: zCommonConfig.shape.sortStrategy.default("date_desc"),
});

export default {
  config,

  discover: (config) =>
    git.getRefData(queries, config.include, config.srcDir).map((v) => ({
      ...v,
      date:
        typeof v.data.custom.committerDate === "string"
          ? new Date(v.data.custom.committerDate)
          : undefined,
    })),

  mutator: (s, c, v) => s(c, v),

  setup: git.setup,
} satisfies Mode<typeof config, Version<git.RefData<keyof typeof queries>>>;
