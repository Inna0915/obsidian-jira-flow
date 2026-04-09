import { FileManager } from "../src/sync/fileManager";
import type { JiraIssue } from "../src/types";

const plugin = {
  settings: {
    storyPointsField: "customfield_story",
    dueDateField: "customfield_due",
    sprintField: "customfield_sprint",
    jiraUsername: "wangph",
    tasksFolder: "Tasks",
    reportsFolder: "Reports",
    assetsFolder: "Assets",
  },
  app: {
    vault: {},
    metadataCache: {},
    fileManager: {},
  },
  jiraApi: {},
} as any;

const fileManager = new FileManager(plugin);

const issue: JiraIssue = {
  key: "PDSTDTTA-9353",
  fields: {
    summary: "组盘完成前,允许直接解绑电池,不要人工搬运到拆盘\n",
    description: null,
    status: { name: "Building 构建中" } as any,
    issuetype: { name: "Story" } as any,
    priority: { name: "Low" } as any,
    assignee: { displayName: "wangph" } as any,
    reporter: { displayName: "chenyl" } as any,
    created: "2026-04-07T10:15:19.000+0800",
    updated: "2026-04-09T14:24:28.000+0800",
    duedate: null,
    labels: [],
    issuelinks: [
      {
        type: { outward: "child of" },
        outwardIssue: {
          key: "PRDAPD-729",
          fields: { summary: "FMS问题\n" },
        },
      },
    ],
    customfield_story: 0,
    customfield_due: null,
    customfield_sprint: { name: "PI2604 - S1 - PDSTDTTA", state: "ACTIVE" },
  },
};

const frontmatter = (fileManager as any).issueToFrontmatter(issue);
if (frontmatter.summary.includes("\n")) {
  throw new Error("issueToFrontmatter 没有清理 summary 中的换行");
}
if ((frontmatter.parent_summary || "").includes("\n")) {
  throw new Error("issueToFrontmatter 没有清理 parent_summary 中的换行");
}

const yaml = (fileManager as any).frontmatterToYaml(frontmatter);
const summaryLine = yaml.split("\n").find((line) => line.startsWith("summary: "));
const parentSummaryLine = yaml.split("\n").find((line) => line.startsWith("parent_summary: "));

if (!summaryLine || !/^summary: ".*"$/.test(summaryLine)) {
  throw new Error("frontmatterToYaml 仍然把原始换行写进了 summary");
}
if (!parentSummaryLine || !/^parent_summary: ".*"$/.test(parentSummaryLine)) {
  throw new Error("frontmatterToYaml 仍然把原始换行写进了 parent_summary");
}

console.log("frontmatter normalization verification passed");
