/**
 * DOM utility functions for creating and manipulating elements
 */

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: {
    textContent?: string;
    className?: string;
    style?: Partial<CSSStyleDeclaration>;
    attributes?: Record<string, string>;
    children?: (HTMLElement | Text)[];
  }
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options?.textContent) element.textContent = options.textContent;
  if (options?.className) element.className = options.className;
  if (options?.style) Object.assign(element.style, options.style);
  if (options?.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  if (options?.children) {
    options.children.forEach(child => element.appendChild(child));
  }
  return element;
}

export function createText(text: string): Text {
  return document.createTextNode(text);
}

export function showToast(message: string, type: 'success' | 'warning' = 'success') {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
}
