/** Tela cheia + trava na horizontal (o Chrome do Android só trava em tela cheia). */

export function fullscreenAvailable(doc: Document = document): boolean {
  return !!doc.fullscreenEnabled && typeof doc.documentElement.requestFullscreen === 'function';
}

export function isFullscreen(doc: Document = document): boolean {
  return !!doc.fullscreenElement;
}

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/** Tenta travar a orientação na horizontal. Devolve se conseguiu. */
export async function lockLandscape(): Promise<boolean> {
  const orientation = screen.orientation as LockableOrientation | undefined;
  if (!orientation?.lock) return false;
  try {
    await orientation.lock('landscape');
    return true;
  } catch {
    return false; // navegador ou aparelho não permite (ex.: fora da tela cheia, iPhone)
  }
}

export async function enterFullscreen(doc: Document = document): Promise<boolean> {
  if (!fullscreenAvailable(doc)) return false;
  try {
    if (!isFullscreen(doc)) await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    return false;
  }
  await lockLandscape();
  return true;
}

export async function exitFullscreen(doc: Document = document): Promise<void> {
  if (!isFullscreen(doc)) return;
  try {
    await doc.exitFullscreen();
  } catch {
    // já saiu (ex.: pelo botão "voltar" do Android)
  }
}

export async function toggleFullscreen(doc: Document = document): Promise<boolean> {
  if (isFullscreen(doc)) {
    await exitFullscreen(doc);
    return false;
  }
  return enterFullscreen(doc);
}
