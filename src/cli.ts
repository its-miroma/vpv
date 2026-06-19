#!/usr/bin/env node
import * as commander from "@commander-js/extra-typings";
import packageJSON from "../package.json" with { type: "json" };
import build from "./build.ts";
import loadConfig from "./config.ts";
import discover from "./discover.ts";
import list from "./list.ts";
import { zVersion } from "./schemas.ts";

const program = new commander.Command(packageJSON.name)
  .description(packageJSON.description)
  .version(packageJSON.version, "-v, --version");

program
  .command("list", { isDefault: true })
  .description("list all discovered versions")
  .option("-b, --base <base>", "base for the default version", (b) => zVersion.shape.base.parse(b))
  .option("-c, --config <path>", "path to versions config")
  .option("-r, --raw", "output raw JSON", false)
  .action(async (options) => {
    const config = await loadConfig(options.config);
    if (options.base !== undefined) {
      config.baseForDefault = options.base;
    }

    const versions = discover(config);
    list(config, versions, options.raw);
  });

program
  .command("build")
  .description("build all discovered versions")
  .option("-b, --base <base>", "base for the default version", (b) => zVersion.shape.base.parse(b))
  .option("-c, --config <path>", "path to versions config")
  .action(async (options) => {
    const config = await loadConfig(options.config);
    if (options.base !== undefined) {
      config.baseForDefault = options.base;
    }

    const versions = discover(config);
    await build(config, versions);
  });

await program.parseAsync();
