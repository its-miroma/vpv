import * as path from "node:path";
import * as pLimit from "p-limit";
import * as vitePress from "vitepress";
import modes from "./modes/index.js";
import type { Config, Version } from "./types.js";

export default async (config: Config, versions: [Version, ...Version[]]) => {
  const limit = pLimit.default(config.build.concurrency);

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
  const listeners: { s: (typeof signals)[number]; listener: () => void }[] = [];
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
    listeners.push({ s, listener });
  }

  const start = Date.now();
  console.log(`building ${String(versions.length)} versions...`);

  const build = async (v: Version) => {
    let onAbort: () => unknown = () => undefined;
    if (abortController.signal.aborted) {
      return;
    }

    const src = path.resolve(config.build.srcRoot, v.src ?? `.${v.base}`);
    const outDir = path.resolve(path.join(config.build.outRoot, v.base));
    const base = path.posix.join(config.build.baseForDefault, v.base);

    console.log(
      [
        "",
        `building '${v.name}'...`,
        `- src: ${src}`,
        `- out: ${outDir}`,
        `- base: ${base}`,
        "",
      ].join("\n"),
    );

    try {
      versionToCleanupMap.set(v, modes[config.mode].setup(v as never, src));

      const buildPromise = vitePress.build(src, { outDir, base });

      // TODO: an abort cannot kill VitePress' build, because it does not take an abort signal
      const abortPromise = new Promise((_, reject) => {
        onAbort = () => {
          reject(new Error(`build of '${v.name}' aborted.`));
        };
        abortController.signal.addEventListener("abort", onAbort, { once: true });
      });

      await Promise.race([buildPromise, abortPromise]);
    } catch (cause) {
      buildErrors.push(new Error(`build of '${v.name}' failed.`, { cause }));
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

  console.log(
    [
      "",
      `${String(versions.length)} versions built in ${((Date.now() - start) / 1000).toFixed(2)}s.`,
    ].join("\n"),
  );

  // then, run all cleanups
  cleanup();
  for (const { s, listener } of listeners) {
    process.removeListener(s, listener);
  }

  // finally, check for errors
  const errors = [...buildErrors, ...cleanupErrors];
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `${String(errors.length)} error${errors.length > 1 ? "s" : ""} during build.`,
    );
  }
};
