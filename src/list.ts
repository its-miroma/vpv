import * as path from "node:path";
import type { Config, Version } from "./index.ts";

const dateTimeFormatter = new Intl.DateTimeFormat();

export default (config: Config, versions: Version[], raw: boolean) => {
  if (raw) {
    console.log(JSON.stringify(versions, null, 2));
    return;
  }

  console.log(`discovered ${String(versions.length)} version${versions.length === 1 ? "" : "s"}:`);

  for (const v of versions) {
    const parts: string[] = [
      "-",
      `'${v.name}'`,
      "--",
      path.posix.join(config.baseForDefault, v.base),
    ];

    if (v.date) {
      parts.push("@", dateTimeFormatter.format(v.date));
    }

    if (v.isLatest) {
      parts.push("(latest)");
    }

    console.log(parts.join(" "));
  }
};
