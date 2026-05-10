import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FileManager } from "../src/sync/fileManager";

const appSource = readFileSync(join(process.cwd(), "src", "components", "App.tsx"), "utf8");

const fakeFile = {} as any;
let attempts = 0;

const plugin = {
  settings: {
    tasksFolder: "Tasks",
    reportsFolder: "Reports",
    assetsFolder: "Assets",
  },
  app: {
    vault: {
      getAbstractFileByPath: () => null,
      getFiles: () => [],
    },
    metadataCache: {},
    fileManager: {
      processFrontMatter: async () => {
        attempts += 1;
        if (attempts < 2) {
          const error = new Error("EBUSY: resource busy or locked");
          throw error;
        }
      },
    },
  },
  jiraApi: {},
} as any;

async function main() {
  const fileManager = new FileManager(plugin);
  await fileManager.processFrontMatterWithRetry(fakeFile, () => undefined);

  if (attempts !== 2) {
    throw new Error(`processFrontMatterWithRetry 应在 EBUSY 后重试，实际尝试 ${attempts} 次`);
  }

  const expectations: Array<[string, string, string]> = [
    [appSource, "pendingCardMovesRef", "App 缺少拖拽中的卡片去重状态"],
    [appSource, "pendingCardMovesRef.current.has(cardPath)", "handleCardMove 缺少重复拖拽保护"],
    [appSource, "pendingCardMovesRef.current.add(cardPath)", "handleCardMove 缺少进入中的卡片登记"],
    [appSource, "pendingCardMovesRef.current.delete(cardPath)", "handleCardMove 缺少最终清理中的卡片登记"],
  ];

  for (const [source, needle, message] of expectations) {
    if (!source.includes(needle)) {
      throw new Error(message);
    }
  }

  console.log("ebusy retry and move dedup verification passed");
}

void main();