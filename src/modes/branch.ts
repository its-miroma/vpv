import * as z from "zod";
import { zConfigBase } from "../schemas.js";
import type { Mode } from "../types.js";
import { getRefData, setup } from "./utils/git.js";

const config = z.object({
  mode: z.literal("branch"),
  sortStrategy: zConfigBase.shape.sortStrategy.default("date_desc"),
  include: z.array(z.string()).default(["refs/heads/v*"]),
});

export default {
  config,

  discover: async (config) =>
    (
      await getRefData(
        {
          author_date: "authordate:iso8601-strict",
          committer_date: "committerdate:iso8601-strict",
        } as const,
        config.include,
        config.exclude,
        config.build.srcRoot,
      )
    ).map((v) => ({
      ...v,
      date:
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        typeof v.data.git.committer_date === "string"
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            new Date(v.data.git.committer_date as string)
          : undefined,
    })),

  setup,
} satisfies Mode<typeof config>;
