import type * as z from "zod";
import type { zConfig } from "./config.js";
import type { zConfigBase, zVersion } from "./schemas.js";

export type Version = z.output<typeof zVersion>;

export type Versions = [Version, ...Version[]];

export type Config = z.output<typeof zConfig>;

export interface Mode<T extends Parameters<(typeof zConfigBase)["safeExtend"]>[0]> {
  config: T;

  discover: (config: z.output<T & typeof zConfigBase>) => Promise<Version[]>;

  /** @returns Cleanup function, should "undo" setup. */
  setup: (version: Version) => Promise<() => Promise<unknown>> | undefined;

  /** @todo implement */
  version?: never;
}
