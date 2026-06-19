import type * as vitePress from "vitepress";
import type * as z from "zod";
import type { zConfig } from "./modes.ts";
import type { zCommonConfig, zVersion } from "./schemas.ts";

export type Version<VersionData = undefined> = VersionData extends undefined
  ? z.output<typeof zVersion>
  : z.output<typeof zVersion> & { data: VersionData };

export type ConfigMutator<V extends Version = Version> = (
  superConfigMutator: (c: typeof config, v: typeof version) => typeof c,
  config: vitePress.SiteConfig<vitePress.DefaultTheme.Config> & { versions: Readonly<[V, ...V[]]> },
  version: Readonly<V>,
) => typeof config;

export type Config = z.output<typeof zConfig> & { configMutator: ConfigMutator | undefined };

// TODO: why does C need to be a generic? Why can discover not use typeof config???
export interface Mode<
  C extends Parameters<(typeof zCommonConfig)["safeExtend"]>[0],
  V extends Version,
> {
  config: C;

  discover: (config: z.output<C & typeof zCommonConfig>) => V[];

  mutator: ConfigMutator<V>;

  // TODO: support abort signal
  /** @returns Function to cleanup the setup after the build. */
  setup: (version: V, src: string) => () => unknown;
}

export type VersionsConfig = z.input<typeof zConfig> & { configMutator?: ConfigMutator };
export const defineVersionsConfig = (config: VersionsConfig) => config;
export default defineVersionsConfig;
