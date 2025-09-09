import * as z from "zod";
import { zConfigBase } from "../schemas.js";
import branch from "./branch.js";
import folder from "./folder.js";
import tag from "./tag.js";

const modes = { branch, folder, tag } as const;

export const zConfig = z.discriminatedUnion("mode", [
  zConfigBase.safeExtend(modes.branch.config.shape),
  zConfigBase.safeExtend(modes.folder.config.shape),
  zConfigBase.safeExtend(modes.tag.config.shape),
]);

export default modes;
