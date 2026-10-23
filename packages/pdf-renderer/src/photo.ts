import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@resume-builder/shared";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/**
 * Load a local profile photo as a data URL.
 * Only absolute paths under an allowed base directory are accepted.
 */
export async function loadPhotoDataUrl(
  photoPath: string | null | undefined,
  allowedBaseDirs: string[],
): Promise<string | null> {
  if (!photoPath) return null;

  const absolute = path.resolve(photoPath);
  const allowed = allowedBaseDirs.some((base) => isPathInside(absolute, path.resolve(base)));
  if (!allowed) {
    throw new AppError(
      "PHOTO_PATH_DENIED",
      "Profile photo path is outside allowed directories.",
      { statusCode: 400 },
    );
  }

  const ext = path.extname(absolute).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new AppError("PHOTO_INVALID", `Unsupported photo extension: ${ext}`, {
      statusCode: 400,
    });
  }

  try {
    await access(absolute);
  } catch {
    return null;
  }

  const buffer = await readFile(absolute);
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
          ? "image/gif"
          : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function isPathInside(target: string, base: string): boolean {
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
