/** @todo @import @type Config */
import * as z from "zod";
import { sortPresets } from "./discover.js";

export const zVersion = z.object({
  /** Base path to serve under. Must start and end with '/'. */
  base: z.string().startsWith("/").endsWith("/"),

  /** Directory relative to project root when applicable. */
  src: z.string().optional(),

  /** Whether this entry is the "latest".
   *
   * @see {@link Config.latestVersion}
   */
  isLatest: z.literal(true).optional(),

  /** Last modification date. */
  date: z.date().optional(),

  /** Arbitrary data. */
  data: z.any().optional(),
});

export const zConfigBase = z.object({
  /** Matches to exclude from discovery. */
  exclude: z.array(z.union([z.string(), z.instanceof(RegExp)])).default([]),

  /**
   * Strategy for sorting versions. Either a preset or a custom comparator.
   *
   * @returns `<0`: a before b
   * @returns `>0`: a after b
   */
  sortStrategy: z
    .union([z.enum(sortPresets), z.function({ input: [zVersion, zVersion], output: z.number() })])
    .default("none"),

  /**
   * Which version is considered "latest".
   *
   * @type string: Must match a version base.
   * @type function: Receives the array of versions, sorted by {@link Config.sortStrategy}, and returns a version base.
   *
   * @default (vs) => vs.find((v) => v.base === "/") === undefined ? vs[0].base : "/";
   */
  latestVersion: z
    .union([
      z.string(),
      z.function({
        input: [z.tuple([zVersion], zVersion)],
        output: z.string().optional(),
      }),
    ])
    .optional(),

  /**
   * Which version is served at the site root (`/`).
   *
   * If undefined, falls back to {@link Config.latestVersion}.
   */
  defaultVersion: z
    .union([
      z.string(),
      z.function({
        input: [z.tuple([zVersion], zVersion)],
        output: z.string().optional(),
      }),
    ])
    .optional(),

  /**
   * @todo not implemented yet
   *
   * @returns User-facing label for a Version.
   *
   * @default (version) => `Version ${version.base}${version.isLatest ? " (latest)" : ""}`
   */
  getLabel: z.function({ input: [zVersion], output: z.string() }).optional(),

  /**
   * @todo not implemented yet
   *
   * Whether to hide the "Edit source code" link for non-latest versions.
   */
  hideEditButtonOnOutdated: z.boolean().nullable().default(null),

  /**
   * @todo not implemented yet
   *
   * Hook to manipulate page content.
   *
   * @param yaml Frontmatter object as parsed by `gray-matter`.
   * @param markdown Markdown source of the page.
   * @param path Path to file relative to the version root.
   * @param version Version this page belongs to.
   * @param config The entire {@link Config} object.
   *
   * @example
   * (yaml, markdown, path, version, config) => ({
   *   yaml: { ...yaml, search: false },
   *   markdown: `Version: ${config.getLabel(version)}\n\n${markdown}`
   * })
   */
  manipulateContent: z
    .function({
      input: [z.record(z.string(), z.any()), z.string(), z.string(), zVersion, z.any()],
      output: z.promise(
        z.object({
          yaml: z.record(z.string(), z.any()),
          markdown: z.string(),
        }),
      ),
    })
    .optional(),

  /** Build options. */
  build: z
    .object({
      srcRoot: z.string().default(".vitepress/versions"),
      outRoot: z.string().default(".vitepress/dist"),
      concurrency: z.int().min(1).default(1),
    })
    .prefault({}),
});
