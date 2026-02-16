import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const DATA_ROOT = process.env.AGENTS4D_DATA_DIR
  ? path.resolve(process.env.AGENTS4D_DATA_DIR)
  : path.resolve(process.cwd(), "Data", "Agents4D");

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function appendJsonLine(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const line = `${JSON.stringify(value)}\n`;
  await writeFile(filePath, line, { encoding: "utf-8", flag: "a" });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const metadata = await stat(filePath);
    return metadata.isFile() || metadata.isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function deleteFileIfExists(filePath: string): Promise<void> {
  if (await fileExists(filePath)) {
    await rm(filePath, { force: true });
  }
}

export function newId(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
