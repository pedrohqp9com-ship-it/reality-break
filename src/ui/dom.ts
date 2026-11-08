/** Pequeno ajudante para criar elementos com classe, texto e atributos. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    children?: (Node | null | false | undefined)[];
  } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [key, value] of Object.entries(options.attrs ?? {})) node.setAttribute(key, value);
  for (const child of options.children ?? []) if (child) node.append(child);
  return node;
}

export function actionButton(
  label: string,
  onClick: () => void,
  options: { primary?: boolean; testId?: string; disabled?: boolean } = {},
): HTMLButtonElement {
  const button = el('button', {
    className: `btn${options.primary ? ' btn-primary' : ''}`,
    text: label,
    attrs: { type: 'button', ...(options.testId ? { 'data-testid': options.testId } : {}) },
  });
  button.disabled = !!options.disabled;
  button.addEventListener('click', onClick);
  return button;
}
