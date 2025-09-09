import * as path from "node:path";
import * as tinyglobby from "tinyglobby";
import * as vite from "vite";
import * as z from "zod";
import { zConfig } from "./modes/index.js";

export default async (configPath?: string) => {
  const resolvedPath =
    configPath
    ?? (
      await tinyglobby.glob(".vitepress/{config/versions,versions,versions/index}.{js,ts,mjs,mts}")
    )[0];

  if (resolvedPath === undefined) {
    throw new Error(
      [
        "no config file found.",
        "create '.vitepress/versions.ts' or pass a custom path to --config.",
      ].join("\n"),
    );
  }

  const rawConfig = await vite.loadConfigFromFile(
    { command: "build", mode: process.env["NODE_ENV"] ?? "development" },
    path.resolve(resolvedPath),
  );

  if (rawConfig === null) {
    throw new Error(
      [
        "something went very wrong during config loading.",
        "this is not supposed to happen.",
        `tried: '${resolvedPath}'.`,
      ].join("\n"),
    );
  }

  // TODO: watch rawConfig.dependencies in dev mode

  try {
    return zConfig.parse(rawConfig.config);
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      const issuesLength = cause.issues.length;
      throw new AggregateError(
        cause.issues,
        [
          `config parsing failed with ${String(issuesLength)} issue${issuesLength > 1 ? "s" : ""}.`,
          `tried: '${rawConfig.path}'.`,
        ].join("\n"),
        { cause },
      );
    }

    throw new Error(
      [
        "something went very wrong during config parsing.",
        "this is not supposed to happen.",
        `tried: '${rawConfig.path}'.`,
      ].join("\n"),
      { cause },
    );
  }
};
