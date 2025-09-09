import * as z from "zod";
import { sortPresets } from "./discover.js";

export const zVersion = z.object({
  /**
   * Base path to serve under.
   * Must start and end with '/'.
   */
  base: z.string().startsWith("/").endsWith("/"),

  /** User-facing name representing the version. */
  name: z.string(),

  /**
   * Path to source of the version.
   * Can be absolute or relative to {@link BuildConfig.srcRoot Config.build.srcRoot}.
   */
  src: z.string().optional(),

  /**
   * Whether this entry is the "latest".
   * @see {@link Config.latestVersion}
   */
  isLatest: z.literal(true).optional(),

  /** Last modification date. */
  date: z.date().optional(),
});

export const zConfigBase = z.object({
  /** Exclusion rules applied to bases. Strings match exactly. */
  exclude: z.array(z.union([zVersion.shape.base, z.instanceof(RegExp)])).default([]),

  /**
   * Strategy for sorting versions. Either a preset or a custom comparator.
   * @returns `<0`: a before b
   * @returns `>0`: a after b
   */
  sortStrategy: z
    .union([z.enum(sortPresets), z.function({ input: [zVersion, zVersion], output: z.number() })])
    .default("none"),

  /**
   * Which version is considered "latest".
   * string: Must match a version base.
   * function: Receives the array sorted by {@link Config.sortStrategy}; returns a version base.
   * @default (versions) => versions[0].base
   */
  latestVersion: z
    .union([
      zVersion.shape.base,
      z.function({
        input: [z.tuple([zVersion], zVersion)],
        output: zVersion.shape.base,
      }),
    ])
    .optional(),

  /**
   * Which version is served at the site root ({@link BuildConfig.baseForDefault}).
   * string: Must match a version base.
   * function: Receives the array sorted by {@link Config.sortStrategy}; returns a version base.
   * @default (versions) => versions.find((v) => v.base === "/")?.base ?? latestBase
   */
  defaultVersion: z
    .union([
      zVersion.shape.base,
      z.function({
        input: [z.tuple([zVersion], zVersion)],
        output: zVersion.shape.base,
      }),
    ])
    .optional(),

  /** @todo Hook to mutate the SiteConfig. */
  configMutator: z.never().optional(),

  /** Build options. */
  build: z
    .object({
      baseForDefault: zVersion.shape.base.default("/"),
      srcRoot: z.string().default(".vitepress/versions"),
      outRoot: z.string().default(".vitepress/dist"),
      concurrency: z.int().min(1).default(1),
    })
    .prefault({}),
});

type Config = z.output<typeof zConfigBase>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used for JSDoc
type BuildConfig = Config["build"];
