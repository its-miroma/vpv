import * as z from "zod";
import { zConfigBase } from "../schemas.js";
import type { Mode } from "../types.js";
import { getRefData, setup } from "./utils/git.js";

const config = z.object({
  mode: z.literal("tag"),
  sortStrategy: zConfigBase.shape.sortStrategy.default("num_desc"),
  hideEditButtonOnOutdated: zConfigBase.shape.hideEditButtonOnOutdated.default(true),
  include: z.array(z.string()).default(["refs/tags/v*"]),
  includeCheckoutAs: z.string().startsWith("/").endsWith("/").optional(),
});

export default {
  config,

  discover: async (config) => {
    const versions = (
      await getRefData(
        {
          tag_hash: "objectname",
          commit_hash: "*objectname",

          author_date: "*authordate:iso8601-strict",
          committer_date: "*committerdate:iso8601-strict",
          tagger_date: "taggerdate:iso8601-strict",
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
    }));

    if (typeof config.includeCheckoutAs === "string") {
      versions.push({
        base: config.includeCheckoutAs,
        src: process.cwd(),
        date: new Date(),
        data: null,
      });
    }

    return versions;
  },

  setup,
} satisfies Mode<typeof config>;
