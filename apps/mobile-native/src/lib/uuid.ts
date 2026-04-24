export function uuidv4(): string {
  // RFC4122 v4-ish UUID (format-valid). Uses Math.random (not crypto-secure).
  // Server-side schema only requires UUID shape.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

