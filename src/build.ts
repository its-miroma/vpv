import * as path from "node:path";
import * as pLimit from "p-limit";
import * as vitePress from "vitepress";
import type { Config, ConfigMutator, Version } from "./index.ts";
import modes from "./modes.ts";

export default async (config: Config, versions: [Version, ...Version[]]) => {
  const limit = pLimit.default(config.buildConcurrency);

  // build errors immediately abort all builds
  const buildErrors: Error[] = [];

  // cleanup errors still allow other cleanups to run
  const cleanupErrors: Error[] = [];

  // run cleanups with concurrency and memoization
  const versionToCleanupMap = new Map<Version, () => unknown>();
  const cleanup = () =>
    [...versionToCleanupMap.entries()].reverse().map(([v, c]) => {
      try {
        c();
      } catch (cause) {
        cleanupErrors.push(new Error(`cleanup of '${v.name}' failed.`, { cause }));
      }
    });

  // trap exit signals to cleanup
  const signals = ["SIGINT", "SIGTERM"] as const;
  const listeners = {} as Record<(typeof signals)[number], () => void>;
  const abortController = new AbortController();
  for (const s of signals) {
    const listener = () => {
      if (!abortController.signal.aborted) {
        buildErrors.push(new Error(`aborted due to '${s}'.`));
        abortController.abort();
      }

      cleanup();
    };

    process.on(s, listener);
    listeners[s] = listener;
  }

  const start = Date.now();
  console.log(`building ${String(versions.length)} versions...`);

  const build = async (version: Version) => {
    let onAbort: () => unknown = () => undefined;
    if (abortController.signal.aborted) {
      return;
    }

    const src = path.resolve(version.src ?? `.${version.base}`);
    const outDir = path.resolve(path.join(config.outDir, version.base));
    const base = path.posix.join(config.baseForDefault, version.base);

    console.log(
      [
        "",
        `building '${version.name}'...`,
        `- src: ${src}`,
        `- out: ${outDir}`,
        `- base: ${base}`,
        "",
      ].join("\n"),
    );

    try {
      versionToCleanupMap.set(version, modes[config.mode].setup(version as never, src));

      const onAfterConfigResolve = (c: vitePress.SiteConfig) => {
        try {
          // user-defined mutator, may call s (super) mutator
          const mutate = config.configMutator ?? (((s, c, v) => s(c, v)) as ConfigMutator);

          // mode-specific mutator
          const modeMutate = modes[config.mode].mutator as ConfigMutator;

          c = {
            ...mutate(
              (c) => modeMutate((c) => ({ ...c }), c, version),
              { ...c, versions },
              version,
            ),
          };

          const getLink = (version: string, v: string, path: string) =>
            `${"/..".repeat(version.split("/").filter(Boolean).length)}${v}${path}`.slice(1);

          // add version switcher dropdown to the nav bar
          (((c.userConfig.themeConfig ??= {}) as vitePress.DefaultTheme.Config).nav ??= []).push({
            text: `${version.name}${version.isLatest ? " (latest)" : ""}`,
            items: versions
              .filter((v) => v.base !== version.base)
              .map((v) => ({
                text: `${v.name}${v.isLatest ? " (latest)" : ""}`,
                link: new Function(
                  "pageData",
                  `return (${getLink.toString()})(
                     ${JSON.stringify(version.base)},
                     ${JSON.stringify(v.base)},
                     pageData.relativePath
                   );`,
                ) as never,
                target: "_self",
              })),
          });
        } catch (cause) {
          throw new Error(`failed to mutate config of '${src}'`, { cause });
        }
      };

      const buildPromise = vitePress.build(src, { outDir, base, onAfterConfigResolve });

      // TODO: an abort cannot kill VitePress' build, because it does not take an abort signal
      const abortPromise = new Promise((_, reject) => {
        onAbort = () => {
          reject(new Error(`build of '${version.name}' aborted.`));
        };
        abortController.signal.addEventListener("abort", onAbort, { once: true });
      });

      await Promise.race([buildPromise, abortPromise]);
    } catch (cause) {
      buildErrors.push(new Error(`build of '${version.name}' failed.`, { cause }));
      abortController.abort();
    } finally {
      abortController.signal.removeEventListener("abort", onAbort);
    }
  };

  // first, build the default version
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guaranteed by discovery
  const defaultVersion = versions.find((v) => v.base === "/")!;
  await build(defaultVersion);

  // then, build other versions with concurrency
  if (!abortController.signal.aborted) {
    await Promise.allSettled(
      versions
        .filter((v) => v !== defaultVersion)
        .map((v) =>
          limit(async () => {
            await build(v);
          }),
        ),
    );
  }

  // then, run all cleanups
  cleanup();
  for (const s of signals) {
    process.removeListener(s, listeners[s]);
  }

  // finally, check for errors
  const errors = [...buildErrors, ...cleanupErrors];
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `${String(errors.length)} error${errors.length > 1 ? "s" : ""} during build.`,
    );
  }

  console.log(
    [
      "",
      `${String(versions.length)} version${versions.length > 1 ? "s" : ""} built in ${((Date.now() - start) / 1000).toFixed(2)}s.`,
    ].join("\n"),
  );
};
