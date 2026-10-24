// Catalogs are imported as modules: @lingui/loader compiles them at build time (next.config.ts).
declare module "*.po" {
  import type { Messages } from "@lingui/core";
  export const messages: Messages;
}
