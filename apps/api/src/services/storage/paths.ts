import fs from "node:fs";
import path from "node:path";

export function resolveApiDataDir(): string {
  const fromEnv = process.env.DATA_DIR?.trim();
  if (fromEnv) return path.resolve(process.cwd(), fromEnv);

  const cwd = process.cwd();

  const isRepoRoot = fs.existsSync(path.join(cwd, "apps", "api", "src"));
  if (isRepoRoot) return path.join(cwd, "apps", "api", ".data");

  const isApiDir = fs.existsSync(path.join(cwd, "src"));
  if (isApiDir) return path.join(cwd, ".data");

  return path.join(cwd, ".data");
}

