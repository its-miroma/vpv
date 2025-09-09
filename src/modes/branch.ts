import * as z from "zod";
import { zConfigBase } from "../schemas.js";
import type { Mode, Version } from "../types.js";
import * as git from "./utils/git.js";

const queries = {
  authorDate: "%(authordate:iso8601-strict)",
  committerDate: "%(committerdate:iso8601-strict)",
} as const;

type VersionFromBranch = Version<git.RefData<keyof typeof queries>>;

const config = z.object({
  mode: z.literal("branch"),
  include: z.array(z.string()).default(["refs/heads/v*"]),

  sortStrategy: zConfigBase.shape.sortStrategy.default("date_desc"),
});

export default {
  config,

  discover: (config) =>
    git.getRefData(queries, config.include).map((v) => ({
      ...v,
      date:
        typeof v.data.custom.committerDate === "string"
          ? new Date(v.data.custom.committerDate)
          : undefined,
    })),

  setup: git.setup,
} satisfies Mode<typeof config, VersionFromBranch>;
