#!/usr/bin/env node
import { Command } from "commander";
import build from "./build.js";
import loadConfig from "./config.js";
import discover from "./discover.js";

const packageJSON = (await import("../package.json", { with: { type: "json" } })).default;

const program = new Command();
program.name(packageJSON.name).description(packageJSON.description).version(packageJSON.version);

program
  .command("build")
  .description("Build all versions")
  .option("-c, --config <path>", "Path to versions config")
  .action(async (parameters: { config?: string }) => {
    const config = await loadConfig(parameters.config);
    const versions = await discover(config);
    await build(versions, config);
  });

program
  .command("list", { isDefault: true })
  .description("List found versions")
  .option("-c, --config <path>", "Path to versions config")
  .action(async (parameters: { config?: string }) => {
    const config = await loadConfig(parameters.config);
    const versions = await discover(config);
    // TODO: prettify
    console.log(JSON.stringify(versions, null, 2));
  });

await program.parseAsync();
