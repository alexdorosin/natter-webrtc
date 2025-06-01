export function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id) as T | null;

  if (!element) {
    throw new Error(`Element with id "${id}" not found`);
  }

  return element;
}
