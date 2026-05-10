import { JiraApi } from "../src/api/jira";

const plugin = {
  settings: {
    jiraHost: "https://jira.example.com",
    jiraUsername: "wangph",
    jiraPassword: "secret",
  },
} as any;

const jiraApi = new JiraApi(plugin);

const preferredAssignee = (jiraApi as any).buildAssigneeField({
  accountId: "account-123",
  name: "wangph",
  key: "wangph-key",
});

if (!preferredAssignee || preferredAssignee.name !== "wangph") {
  throw new Error("buildAssigneeField 应优先使用 name，避免把 accountId 发给当前 Jira 实例");
}

const fallbackAssignee = (jiraApi as any).buildAssigneeField({
  accountId: "account-123",
});

if (!fallbackAssignee || fallbackAssignee.accountId !== "account-123") {
  throw new Error("buildAssigneeField 在没有 name/key 时仍应回退到 accountId");
}

console.log("bug assignee identity preference verification passed");