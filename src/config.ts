import { statSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfigFromFile } from "vite";
import * as z from "zod";
import { ZodError } from "zod";
import { modesConfig } from "./modes/index.js";

export const zConfig = z.discriminatedUnion("mode", modesConfig).overwrite((config) => ({
  ...config,
  defaultVersion: config.defaultVersion ?? config.latestVersion,
}));

export default async (configPath?: string) => {
  const resolvedPath =
    configPath !== undefined
      ? resolve(configPath)
      : (() => {
          const candidates = ["js", "ts", "mjs", "mts"].flatMap((extension) => [
            resolve(".vitepress", "config", `versions.${extension}`),
            resolve(".vitepress", "versions", `index.${extension}`),
            resolve(".vitepress", `versions.${extension}`),
          ]);

          const found = candidates.find(
            (f) => statSync(f, { throwIfNoEntry: false })?.isFile() ?? false,
          );

          if (found) {
            return found;
          }
          throw new Error(
            [
              "no config file found.",
              "create '.vitepress/versions.ts' or choose a custom path with --config.",
            ].join("\n"),
          );
        })();

  const rawConfig = await loadConfigFromFile(
    { command: "build", mode: process.env["NODE_ENV"] ?? "development" },
    resolvedPath,
  );

  if (rawConfig === null) {
    throw new Error("something went wrong at config loading.");
  }

  // TODO: watch rawConfig.dependencies during `dev`

  try {
    return zConfig.parse(rawConfig.config);
  } catch (error) {
    const errorText = [`invalid config at "${rawConfig.path}".`];
    if (error instanceof ZodError) {
      error.issues.forEach((e) => errorText.push(`  - [${e.path.join(".")}] ${e.message}`));
    }
    throw new Error(errorText.join("\n"), { cause: error });
  }
};
