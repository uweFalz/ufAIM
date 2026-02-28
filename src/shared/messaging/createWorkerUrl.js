// src/shared/messaging/createWorkerUrl.js

export function createWorkerUrl(specifier) {
  // ImportMap-Auflösung funktioniert in new URL(spec, import.meta.url)
  // wenn diese Funktion aus einem ES-Modul heraus genutzt wird.
  return new URL(specifier, import.meta.url).href;
}
