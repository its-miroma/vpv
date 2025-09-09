#!/usr/bin/env node
import * as commander from "@commander-js/extra-typings";
import build from "./build.js";
import loadConfig from "./config.js";
import discover from "./discover.js";
import list from "./list.js";
import { zVersion } from "./schemas.js";

const packageJSON = (await import("../package.json", { with: { type: "json" } })).default;

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
      config.build.baseForDefault = options.base;
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
      config.build.baseForDefault = options.base;
    }

    const versions = discover(config);
    await build(config, versions);
  });

await program.parseAsync();
