import fs from "fs/promises";
import path from "path";

const XLSX_EXT = /\.(xlsx|xlsm|xls)$/i;
const TEMP_PREFIX = /^~\$/;

export function getDataDirectory(): string {
  return path.join(process.cwd(), "data");
}

export function isWorkbookFileName(fileName: string): boolean {
  return XLSX_EXT.test(fileName) && !TEMP_PREFIX.test(fileName);
}

export function resolveDataFilePath(fileName: string): string {
  const safe = path.basename(fileName);
  if (!isWorkbookFileName(safe)) {
    throw new Error("Invalid workbook file name.");
  }
  return path.join(getDataDirectory(), safe);
}

export async function ensureDataDirectory(): Promise<void> {
  await fs.mkdir(getDataDirectory(), { recursive: true });
}

export async function readWorkbookFromDataFolder(
  fileName: string,
): Promise<{ buffer: ArrayBuffer; fileName: string }> {
  await ensureDataDirectory();
  const filePath = resolveDataFilePath(fileName);
  const fileBuffer = await fs.readFile(filePath);
  const buffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  );
  return { buffer, fileName: path.basename(filePath) };
}

export type DataFileInfo = {
  name: string;
  mtimeMs: number;
  size: number;
};

export async function listDataWorkbooks(): Promise<DataFileInfo[]> {
  await ensureDataDirectory();
  const entries = await fs.readdir(getDataDirectory(), { withFileTypes: true });
  const files: DataFileInfo[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !isWorkbookFileName(entry.name)) continue;
    const stat = await fs.stat(path.join(getDataDirectory(), entry.name));
    files.push({
      name: entry.name,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    });
  }

  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}
