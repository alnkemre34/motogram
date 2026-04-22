export function createURL(path: string): string {
  return `motogram://${path.replace(/^\//, '')}`;
}

export default { createURL };
