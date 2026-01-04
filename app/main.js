// app/main.js
import { bootApp } from "./core/appCore.js";

bootApp().catch((e) => {
  console.error(e);
  const log = document.getElementById("log");
  if (log) log.textContent += "\nBOOT FAILED: " + String(e);
});
