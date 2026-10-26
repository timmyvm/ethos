/**
 * The layers open over the app, bottom to top. `components/ui/Overlay.tsx`
 * opens one for each sheet's panel as it mounts and closes it as it goes.
 *
 * Anything that moves for its own sake asks whether a layer sits over it
 * and rests while one does. Demos's idle clip behind the paywall was a
 * video decoding and a WebGL texture uploading every frame for nobody,
 * and those frames came out of the sheet's own drag: the pull stuttered
 * and read slower than the finger, so a long pull sprang back (#242).
 */

const layers: Node[] = [];
const listeners = new Set<() => void>();

function changed() {
  for (const fn of [...listeners]) fn();
}

/** A layer is up over everything under it; the returned call takes it down. */
export function openLayer(el: Node): () => void {
  layers.push(el);
  changed();
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    const at = layers.indexOf(el);
    if (at >= 0) layers.splice(at, 1);
    changed();
  };
}

/** True while an open layer covers `el`: there is one, and the top one does not hold it. */
export function underLayer(el: Node): boolean {
  const top = layers[layers.length - 1];
  return top !== undefined && !top.contains(el);
}

/** Called whenever a layer opens or closes; returns the unsubscribe. */
export function onLayers(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
