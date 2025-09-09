import type * as z from "zod";
import type { zConfig } from "./modes/index.js";
import type { zConfigBase, zVersion } from "./schemas.js";

export type Version<VersionData = undefined> = VersionData extends undefined
  ? z.output<typeof zVersion>
  : z.output<typeof zVersion> & { data: VersionData };

export type Config = z.output<typeof zConfig>;

export type VersionsConfig = z.input<typeof zConfig>;

export interface Mode<
  C extends Parameters<(typeof zConfigBase)["safeExtend"]>[0],
  V extends Version,
> {
  config: C;

  discover: (config: z.output<C & typeof zConfigBase>) => V[];

  // TODO: support abort signal
  /** @returns Function to cleanup the setup after the build. */
  setup: (version: V, src: string) => () => unknown;
}
