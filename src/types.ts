import type * as vitePress from "vitepress";
import type * as z from "zod";
import type { zConfig } from "./modes/index.js";
import type { zConfigBase, zVersion } from "./schemas.js";

export type Version<VersionData = undefined> = VersionData extends undefined
  ? z.output<typeof zVersion>
  : z.output<typeof zVersion> & { data: VersionData };

// TODO: drop with VitePress 2: https://github.com/vuejs/vitepress/commit/777e2caaacd93ce41b046f6c9d5ba80cc43ba37c
type PatchedVitePressSiteConfig<V extends Version> = Omit<
  vitePress.SiteConfig<vitePress.DefaultTheme.Config>,
  "userConfig"
> & {
  userConfig: Omit<vitePress.UserConfig<vitePress.DefaultTheme.Config>, "themeConfig"> & {
    themeConfig: vitePress.DefaultTheme.Config | undefined;
  };
  versions: [V, ...V[]];
};

export type ConfigMutator<V extends Version = Version> = (
  superConfigMutator: (c: typeof config, v: typeof version) => typeof c,
  config: Readonly<PatchedVitePressSiteConfig<V>>,
  version: Readonly<V>,
) => typeof config;

export type Config = z.output<typeof zConfig> & { configMutator: ConfigMutator | undefined };

export type VersionsConfig = z.input<typeof zConfig> & { configMutator?: ConfigMutator };

export interface Mode<
  C extends Parameters<(typeof zConfigBase)["safeExtend"]>[0],
  V extends Version,
> {
  config: C;

  discover: (config: z.output<C & typeof zConfigBase>) => V[];

  mutator: ConfigMutator<V>;

  // TODO: support abort signal
  /** @returns Function to cleanup the setup after the build. */
  setup: (version: V, src: string) => () => unknown;
}
