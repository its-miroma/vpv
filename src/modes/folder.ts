import { readdirSync, statSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { glob } from "tinyglobby";
import * as z from "zod";
import { zConfigBase } from "../schemas.js";
import type { Mode } from "../types.js";

// TODO: parents must exclude their children
const config = z.object({
  mode: z.literal("folder"),
  sortStrategy: zConfigBase.shape.sortStrategy.default("alpha_asc"),
  include: z.array(z.string()).default(["./", "./.versions/*"]),
});

export default {
  config,

  discover: async (config) =>
    [...new Set(await glob(config.include, { onlyDirectories: true }))]
      .filter(
        (p) =>
          !config.exclude.some(
            (e) => (typeof e === "string" && e === p) || (e instanceof RegExp && e.test(p)),
          ),
      )
      .map((p) => ({
        base: p,
        src: p,
        date: new Date(
          ((dir: string) => {
            let max = 0;
            const stack = [dir];
            while (stack.length) {
              const dir = stack.pop()!;
              let entries: Dirent[] = [];
              try {
                entries = readdirSync(dir, { withFileTypes: true });
              } catch {
                continue;
              }
              for (const entry of entries) {
                const entryPath = join(dir, entry.name);
                try {
                  const stat = statSync(entryPath);
                  if (stat.isDirectory()) {
                    stack.push(entryPath);
                  } else if (stat.mtimeMs > max) {
                    max = stat.mtimeMs;
                  }
                } catch {}
              }
            }
            return max || undefined;
          })(p) ?? Date.now(),
        ),
      })),

  setup: async () => async () => null,
} satisfies Mode<typeof config>;
