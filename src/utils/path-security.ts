import fs from "node:fs";
import path from "node:path";

export function isPathWithinBase(resolvedPath: string, basePath: string): boolean {
  const base = path.resolve(basePath);
  const target = path.resolve(resolvedPath);
  const relative = path.relative(base, target);
  if (!relative) return true;
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveReal(pathToResolve: string): string {
  try {
    return fs.realpathSync(pathToResolve);
  } catch {
    return path.resolve(pathToResolve);
  }
}

export function resolveSafePath(basePath: string, relativePath: string): string {
  const base = path.resolve(basePath);
  const target = path.isAbsolute(relativePath)
    ? path.resolve(relativePath)
    : path.resolve(base, relativePath);

  const baseReal = resolveReal(base);
  if (!isPathWithinBase(target, base)) {
    throw new Error("Path escapes base directory");
  }

  const relative = path.relative(base, target);
  const parts = relative.split(path.sep).filter(Boolean);
  let current = base;

  for (const part of parts) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) {
      break;
    }
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      const resolved = resolveReal(current);
      if (!isPathWithinBase(resolved, baseReal)) {
        throw new Error("Symlink escapes base directory");
      }
    }
  }

  const finalResolved = resolveReal(target);
  if (!isPathWithinBase(finalResolved, baseReal)) {
    throw new Error("Path escapes base directory");
  }

  return target;
}
