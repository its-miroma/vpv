import type * as z from "zod";
import { type zConfig } from "./config.js";

export const defineVersionsConfig = (config: z.input<typeof zConfig>) => config;
