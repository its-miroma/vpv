import * as z from "zod";
import type { Mode, Version } from "../index.ts";
import { zCommonConfig, zVersion } from "../schemas.ts";
import * as git from "./utils/git.ts";

const queries = {
  tagHash: "%(objectname)",

  authorDate: "%(*authordate:iso8601-strict)",
  committerDate: "%(*committerdate:iso8601-strict)",
  taggerDate: "%(taggerdate:iso8601-strict)",
} as const;

const config = z.object({
  /** Discover versions through Git tags. */
  mode: z.literal("tag"),

  /** Globs that must match Git refs. */
  include: z.array(z.string()).default(["refs/tags/v*"]),

  /** Version associated with the currently checked-out tree. */
  includeCheckoutAs: z
    .union([zVersion.partial().required({ base: true }), z.null()])
    .default(null)
    .transform((v) =>
      v === null
        ? v
        : {
            ...v,
            name: v.name ?? "Checkout",
            src: v.src ?? process.cwd(),
            date: v.date ?? (git.hasUncommittedChanges() ? new Date() : git.getLastCommitDate()),
          },
    ),

  /** Directory in which branches will be temporarily checked-out. */
  srcDir: z.string().default(".vitepress/.temp/versions"),

  sortStrategy: zCommonConfig.shape.sortStrategy.default("num_desc"),
});

export default {
  config,

  discover: (config) => [
    ...(config.includeCheckoutAs === null ? [] : [config.includeCheckoutAs]),
    ...git.getRefData(queries, config.include, config.srcDir).map((v) => ({
      ...v,
      date:
        typeof v.data.custom.committerDate === "string"
          ? new Date(v.data.custom.committerDate)
          : undefined,
    })),
  ],

  mutator: (s, c, v) => {
    const config = s(c, v);

    if (!v.isLatest) {
      delete config.userConfig.themeConfig?.editLink;
    }

    return config;
  },

  setup: (v, src) => ("data" in v ? git.setup(v, src) : () => undefined),
} satisfies Mode<typeof config, Version<git.RefData<keyof typeof queries> | undefined>>;
