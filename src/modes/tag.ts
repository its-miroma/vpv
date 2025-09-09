import * as z from "zod";
import { zConfigBase, zVersion } from "../schemas.js";
import type { Mode, Version } from "../types.js";
import * as git from "./utils/git.js";

const queries = {
  tagHash: "%(objectname)",

  authorDate: "%(*authordate:iso8601-strict)",
  committerDate: "%(*committerdate:iso8601-strict)",
  taggerDate: "%(taggerdate:iso8601-strict)",
} as const;

type VersionFromTag = Version<git.RefData<keyof typeof queries> | undefined>;

const config = z.object({
  mode: z.literal("tag"),
  include: z.array(z.string()).default(["refs/tags/v*"]),
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

  sortStrategy: zConfigBase.shape.sortStrategy.default("num_desc"),
});

export default {
  config,

  discover: (config) => [
    ...(config.includeCheckoutAs === null ? [] : [config.includeCheckoutAs]),
    ...git.getRefData(queries, config.include).map((v) => ({
      ...v,
      date:
        typeof v.data.custom.committerDate === "string"
          ? new Date(v.data.custom.committerDate)
          : undefined,
    })),
  ],

  setup: (v, src) => ("data" in v ? git.setup(v, src) : () => undefined),
} satisfies Mode<typeof config, VersionFromTag>;
