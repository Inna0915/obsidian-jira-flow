export class TFile {}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export async function requestUrl(): Promise<never> {
  throw new Error("obsidian requestUrl stub should not be called in this verification script");
}