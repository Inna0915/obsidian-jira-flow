import { parseJiraSprintName, parseJiraSprintState } from "../src/utils/jiraParser";
import { FileManager } from "../src/sync/fileManager";

const oldSprint = "com.atlassian.greenhopper.service.sprint.Sprint@1[id=10,rapidViewId=1,state=CLOSED,name=Sprint 10,goal=,startDate=2024-01-01T00:00:00.000Z,endDate=2024-01-14T00:00:00.000Z,completeDate=2024-01-14T00:00:00.000Z,sequence=10]";
const activeSprint = "com.atlassian.greenhopper.service.sprint.Sprint@2[id=11,rapidViewId=1,state=ACTIVE,name=Sprint 11,goal=,startDate=2024-01-15T00:00:00.000Z,endDate=2024-01-28T00:00:00.000Z,completeDate=<null>,sequence=11]";

const reversedSprintHistory = [activeSprint, oldSprint];
const objectSprintHistory = [
  { id: 20, sequence: 20, state: "closed", name: "Sprint 20" },
  { id: 21, sequence: 21, state: "active", name: "Sprint 21" },
];

const assertEqual = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) {
    throw new Error(`${label} failed. Expected ${String(expected)}, received ${String(actual)}`);
  }
};

assertEqual(parseJiraSprintName(reversedSprintHistory), "Sprint 11", "string sprint history name");
assertEqual(parseJiraSprintState(reversedSprintHistory), "ACTIVE", "string sprint history state");
assertEqual(parseJiraSprintName(objectSprintHistory), "Sprint 21", "object sprint history name");
assertEqual(parseJiraSprintState(objectSprintHistory), "ACTIVE", "object sprint history state");

const fileManager = new FileManager({} as never);
const shouldSkipSync = (fileManager as unknown as {
  canSkipSync(existing: Record<string, unknown>, incoming: Record<string, unknown>): boolean;
}).canSkipSync(
  {
    archived: false,
    jira_key: "JIRA-1",
    mapped_column: "TO DO",
    reporter_only: false,
    sprint: "Sprint 10",
    sprint_state: "CLOSED",
    status: "TO DO",
    summary: "Carry-over task",
    updated: "2024-01-14T00:00:00.000Z",
  },
  {
    archived: false,
    jira_key: "JIRA-1",
    mapped_column: "TO DO",
    reporter_only: false,
    sprint: "Sprint 11",
    sprint_state: "ACTIVE",
    status: "TO DO",
    summary: "Carry-over task",
    updated: "2024-01-14T00:00:00.000Z",
  }
);

assertEqual(shouldSkipSync, false, "sync skip guard should refresh changed sprint metadata");

console.log("jiraParser verification passed");