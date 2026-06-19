import * as z from "zod";
import branch from "./modes/branch.ts";
import folder from "./modes/folder.ts";
import tag from "./modes/tag.ts";
import { zCommonConfig } from "./schemas.ts";

const modes = { branch, folder, tag } as const;

export const zConfig = z.discriminatedUnion("mode", [
  zCommonConfig.safeExtend(modes.branch.config.shape),
  zCommonConfig.safeExtend(modes.folder.config.shape),
  zCommonConfig.safeExtend(modes.tag.config.shape),
]);

export default modes;
