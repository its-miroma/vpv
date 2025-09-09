import { join as pathJoin, resolve as pathResolve } from "node:path";
import { build as vitepressBuild } from "vitepress";
import modes from "./modes/index.js";
import type { Config, Version, Versions } from "./types.js";

async function build(v: Version, config: Config) {
  let cleanup: () => Promise<unknown> = async () => null;

  try {
    cleanup = await modes[config.mode].setup(v);

    await vitepressBuild(pathResolve(v.src ?? pathJoin(config.build.srcRoot, v.base)), {
      base: v.base,
      outDir: pathResolve(pathJoin(config.build.outRoot, v.base)),
    });
  } catch (error) {
    throw new Error(`build failed for "${v.base}".`, { cause: error });
  } finally {
    if (v.base === "/") {
      return cleanup;
    }

    try {
      await cleanup();
    } catch (error) {
      console.error([`cleanup failed for "${v.base}".`, error].join("\n"));
    }

    return undefined;
  }
}

export default async (versions: Versions, config: Config): Promise<void> => {
  const abort = new AbortController();

  const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
  const abortOnSignal = (s: (typeof signals)[number]) => {
    console.error(`received ${s}, aborting...`);
    abort.abort(new Error(`aborted on ${s}.`));
  };

  for (const s of signals) {
    process.on(s, abortOnSignal);
  }

  const defaultVersion = versions.find((v) => v.base === "/");
  if (!defaultVersion) {
    throw new Error("no defaultVersion found.");
  }

  // store defaultVersion's cleanup, because it must be ran last
  let defaultCleanup: Awaited<ReturnType<typeof build>>;

  try {
    // build defaultVersion first
    defaultCleanup = await build(defaultVersion, config);

    // build others with concurrency
    const queue = versions.filter((v) => v !== defaultVersion);
    const promises: Promise<void>[] = [];

    const worker = async () => {
      while (queue.length && !abort.signal.aborted) {
        const v = queue.shift()!;
        try {
          await build(v, config);
        } catch (error) {
          abort.abort(error);
        }
      }
    };

    for (let i = 0; i < config.build.concurrency; i++) {
      promises.push(worker());
    }

    const results = await Promise.allSettled(promises);
    const reject = results.find((r) => r.status === "rejected")?.reason as Error | undefined;

    if (abort.signal.aborted) {
      throw abort.signal.reason;
    } else if (reject) {
      throw reject;
    }
  } catch (error) {
    throw new Error("build failed.", { cause: error });
  } finally {
    await defaultCleanup?.();
    for (const s of signals) {
      process.removeListener(s, abortOnSignal);
    }
  }
};
