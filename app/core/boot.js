import { AppCore } from "./AppCore.js";

export function boot(uiRefs) {
  const app = new AppCore(uiRefs);
  app.start();
  return app;
}
