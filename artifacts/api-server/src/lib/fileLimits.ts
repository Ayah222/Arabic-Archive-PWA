function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const megabyte = 1024 * 1024;
const gigabyte = 1024 * 1024 * 1024;

export const FILE_LIMITS = {
  maxFileBytes: positiveNumber(process.env.SA_MAX_FILE_MB, 500) * megabyte,
  maxFolderFiles: Math.floor(positiveNumber(process.env.SA_MAX_FOLDER_FILES, 10000)),
  maxFolderBytes: positiveNumber(process.env.SA_MAX_FOLDER_GB, 5) * gigabyte,
  maxZipArchiveBytes: positiveNumber(process.env.SA_MAX_ZIP_ARCHIVE_GB, 1) * gigabyte,
} as const;

export function publicFileLimits() {
  return {
    maxFileBytes: FILE_LIMITS.maxFileBytes,
    maxFolderFiles: FILE_LIMITS.maxFolderFiles,
    maxFolderBytes: FILE_LIMITS.maxFolderBytes,
    maxZipArchiveBytes: FILE_LIMITS.maxZipArchiveBytes,
  };
}