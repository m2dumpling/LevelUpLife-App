export interface FloatingNumberDetail {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

export const FLOATING_NUMBER_EVENT = "floating-number";

let nextId = 0;

export function spawnFloatingNumber(
  x: number,
  y: number,
  text: string,
  color: string,
): number {
  const id = ++nextId;
  window.dispatchEvent(new CustomEvent(FLOATING_NUMBER_EVENT, {
    detail: { id, x, y, text, color },
  }));
  return id;
}
