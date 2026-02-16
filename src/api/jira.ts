import { requestUrl, type RequestUrlParam } from "obsidian";
import type JiraFlowPlugin from "../main";
import { mapStatusToColumn } from "../types";
import type { JiraBoard, JiraIssue, JiraSearchResponse, JiraSprint } from "../types";

export class JiraApi {
  private plugin: JiraFlowPlugin;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
  }

  private get authHeader(): string {
    const { jiraUsername, jiraPassword } = this.plugin.settings;
    return "Basic " + btoa(`${jiraUsername}:${jiraPassword}`);
  }

  private get baseUrl(): string {
    return this.plugin.settings.jiraHost.replace(/\/+$/, "");
  }

  private async request<T>(endpoint: string, method = "GET", body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/rest/api/2/${endpoint}`;
    const params: RequestUrlParam = {
      url,
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Atlassian-Token": "no-check",
        "User-Agent": "Obsidian-Jira-Flow",
      },
      throw: false,
    };
    if (body) {
      params.body = JSON.stringify(body);
    }
    const response = await requestUrl(params);
    if (response.status >= 400) {
      let detail = "";
      try {
        const errBody = response.json;
        detail = errBody?.errorMessages?.join("; ") || errBody?.message || JSON.stringify(errBody);
      } catch {
        detail = response.text?.slice(0, 500) || "";
      }
      console.error(`[Jira Flow] ${method} ${url} → ${response.status}`, detail);
      throw new Error(`Request failed, status ${response.status}: ${detail}`);
    }
    // Handle empty responses (e.g. 204 No Content from POST /transitions)
    if (response.status === 204 || !response.text || response.text.trim() === "") {
      return undefined as T;
    }
    try {
      return response.json as T;
    } catch {
      return undefined as T;
    }
  }

  private async agileRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}/rest/agile/1.0/${endpoint}`;
    const response = await requestUrl({
      url,
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Atlassian-Token": "no-check",
        "User-Agent": "Obsidian-Jira-Flow",
      },
      throw: false,
    });
    if (response.status >= 400) {
      let detail = "";
      try {
        const errBody = response.json;
        detail = errBody?.errorMessages?.join("; ") || errBody?.message || JSON.stringify(errBody);
      } catch {
        detail = response.text?.slice(0, 500) || "";
      }
      console.error(`[Jira Flow] GET ${url} → ${response.status}`, detail);
      throw new Error(`Agile request failed, status ${response.status}: ${detail}`);
    }
    return response.json as T;
  }

  async testConnection(): Promise<void> {
    await this.request("myself");
  }

  // ===== 4-Step Agile Sync =====

  /** Step 1: Detect board ID for a project */
  async detectBoardId(projectKey: string): Promise<JiraBoard | null> {
    try {
      const data = await this.agileRequest<{ values: JiraBoard[] }>(
        `board?projectKeyOrId=${encodeURIComponent(projectKey)}`
      );
      if (!data.values || data.values.length === 0) return null;
      // Prefer scrum board
      const scrum = data.values.find((b) => b.type === "scrum");
      return scrum || data.values[0];
    } catch {
      return null;
    }
  }

  /** Step 2: Fetch active sprint for a board */
  async fetchActiveSprint(boardId: number): Promise<JiraSprint | null> {
    for (const state of ["active", "future", "closed"]) {
      try {
        const data = await this.agileRequest<{ values: JiraSprint[] }>(
          `board/${boardId}/sprint?state=${state}&maxResults=1`
        );
        if (data.values && data.values.length > 0) {
          return data.values[0];
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  /** Step 3: Fetch issues in a sprint (only current user's tasks) */
  async fetchSprintIssues(sprintId: number): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 100;
    const jql = encodeURIComponent('assignee=currentUser()');

    while (true) {
      const data = await this.agileRequest<JiraSearchResponse>(
        `sprint/${sprintId}/issue?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,description,status,issuetype,priority,assignee,created,updated,duedate,labels,sprint,customfield_10016,customfield_10329`
      );
      allIssues.push(...data.issues);
      if (startAt + maxResults >= data.total) break;
      startAt += maxResults;
    }

    return allIssues;
  }

  /** Step 4: Fetch backlog issues */
  async fetchBacklogIssues(boardId: number, projectKey: string): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 100;

    try {
      while (true) {
        const data = await this.agileRequest<JiraSearchResponse>(
          `board/${boardId}/backlog?startAt=${startAt}&maxResults=${maxResults}&jql=${encodeURIComponent(`project="${projectKey}" AND assignee=currentUser()`)}&fields=summary,description,status,issuetype,priority,assignee,created,updated,duedate,labels,sprint,customfield_10016,customfield_10329`
        );
        // Filter out issues that already have a sprint (avoid duplicates)
        const backlogOnly = data.issues.filter((issue) => !issue.fields.sprint);
        allIssues.push(...backlogOnly);
        if (startAt + maxResults >= data.total) break;
        startAt += maxResults;
      }
    } catch {
      // Backlog API may not be available on all boards
    }

    return allIssues;
  }

  /** Full Agile sync: returns all issues (sprint + backlog) */
  async fetchIssuesAgile(projectKey: string): Promise<{ issues: JiraIssue[]; sprint: JiraSprint | null }> {
    // Step 1
    const board = await this.detectBoardId(projectKey);
    if (!board) {
      throw new Error(`No board found for project "${projectKey}". Falling back to JQL.`);
    }

    // Step 2
    const sprint = await this.fetchActiveSprint(board.id);

    let sprintIssues: JiraIssue[] = [];
    if (sprint) {
      // Step 3
      sprintIssues = await this.fetchSprintIssues(sprint.id);
    }

    // Step 4
    const backlogIssues = await this.fetchBacklogIssues(board.id, projectKey);

    // Merge & deduplicate by key
    const seen = new Set<string>();
    const allIssues: JiraIssue[] = [];
    for (const issue of [...sprintIssues, ...backlogIssues]) {
      if (!seen.has(issue.key)) {
        seen.add(issue.key);
        allIssues.push(issue);
      }
    }

    return { issues: allIssues, sprint };
  }

  /** JQL fallback fetch (original method, with extra fields) */
  async fetchIssues(): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 50;

    while (true) {
      const jql = this.plugin.settings.jql;
      const data = await this.request<JiraSearchResponse>(
        `search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,description,status,issuetype,priority,assignee,created,updated,duedate,labels,sprint,customfield_10016,customfield_10329`
      );
      allIssues.push(...data.issues);
      if (startAt + data.maxResults >= data.total) break;
      startAt += maxResults;
    }

    return allIssues;
  }

  /** Transition issue by target column ID (uses normalizeStatus matching) */
  async transitionIssue(issueKey: string, targetColumnId: string): Promise<{ success: boolean; actualStatus?: string; actualColumn?: string }> {
    try {
      // Step 1: Get available transitions
      console.log(`[Jira Flow] Transition ${issueKey}: requesting available transitions...`);
      const data = await this.request<{
        transitions: Array<{ id: string; name: string; to: { name: string } }>;
      }>(`issue/${issueKey}/transitions`);

      console.log(`[Jira Flow] Transition ${issueKey}: available transitions:`,
        data.transitions.map((t) => `[${t.id}] "${t.name}" → "${t.to.name}" (maps to: ${mapStatusToColumn(t.to.name)})`)
      );
      console.log(`[Jira Flow] Transition ${issueKey}: target column = "${targetColumnId}"`);

      // Step 2: Match target transition
      // 2a: mapStatusToColumn match
      let target = data.transitions.find(
        (t) => mapStatusToColumn(t.to.name) === targetColumnId
      );
      if (target) {
        console.log(`[Jira Flow] Transition ${issueKey}: matched via mapStatusToColumn → [${target.id}] "${target.name}"`);
      }

      // 2b: direct name match
      if (!target) {
        target = data.transitions.find(
          (t) => t.to.name.toUpperCase() === targetColumnId.toUpperCase()
        );
        if (target) {
          console.log(`[Jira Flow] Transition ${issueKey}: matched via direct name → [${target.id}] "${target.name}"`);
        }
      }

      // 2c: partial keyword match
      if (!target) {
        const colLower = targetColumnId.toLowerCase();
        target = data.transitions.find(
          (t) => t.name.toLowerCase().includes(colLower) || t.to.name.toLowerCase().includes(colLower)
        );
        if (target) {
          console.log(`[Jira Flow] Transition ${issueKey}: matched via keyword → [${target.id}] "${target.name}"`);
        }
      }

      if (!target) {
        console.warn(
          `[Jira Flow] Transition ${issueKey}: NO matching transition found for column "${targetColumnId}". Available:`,
          data.transitions.map((t) => `[${t.id}] "${t.name}" → "${t.to.name}" (${mapStatusToColumn(t.to.name)})`)
        );
        return { success: false };
      }

      // Step 3: Execute transition
      // Determine if target is a "Done" category (needs Resolution field)
      const DONE_COLUMNS = new Set(["DONE", "CLOSED", "RESOLVED"]);
      const isDoneStatus = DONE_COLUMNS.has(targetColumnId);

      const transitionBody: Record<string, unknown> = {
        transition: { id: target.id },
      };
      if (isDoneStatus) {
        transitionBody.fields = { resolution: { name: "Done" } };
        console.log(`[Jira Flow] Transition ${issueKey}: target is Done-category, injecting resolution field`);
      }

      console.log(`[Jira Flow] Transition ${issueKey}: executing transition [${target.id}] "${target.name}"...`);
      try {
        await this.request(`issue/${issueKey}/transitions`, "POST", transitionBody);
        console.log(`[Jira Flow] Transition ${issueKey}: transition succeeded`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // If first attempt failed and we didn't include resolution, retry with it
        if (!isDoneStatus && (msg.includes("resolution") || msg.includes("Resolution"))) {
          console.warn(`[Jira Flow] Transition ${issueKey}: retrying with resolution field...`);
          try {
            await this.request(`issue/${issueKey}/transitions`, "POST", {
              transition: { id: target.id },
              fields: { resolution: { name: "Done" } },
            });
            console.log(`[Jira Flow] Transition ${issueKey}: retry with resolution succeeded`);
          } catch (e2) {
            const msg2 = e2 instanceof Error ? e2.message : String(e2);
            console.error(`[Jira Flow] Transition ${issueKey}: retry also failed: ${msg2}`);
            return { success: false };
          }
        } else {
          console.error(`[Jira Flow] Transition ${issueKey}: POST failed: ${msg}`);
          return { success: false };
        }
      }

      // Step 4: Re-fetch issue to get actual post-transition status
      try {
        const updated = await this.request<{ fields: { status: { name: string } } }>(
          `issue/${issueKey}?fields=status`
        );
        const actualStatus = updated.fields.status.name;
        const actualColumn = mapStatusToColumn(actualStatus);
        console.log(`[Jira Flow] Transition ${issueKey}: post-transition status = "${actualStatus}" → column "${actualColumn}"`);
        return { success: true, actualStatus, actualColumn };
      } catch {
        console.warn(`[Jira Flow] Transition ${issueKey}: re-fetch failed, using expected values`);
        return { success: true, actualStatus: target.to.name, actualColumn: targetColumnId };
      }
    } catch (e) {
      console.error(`[Jira Flow] Transition ${issueKey}: unexpected error:`, e);
      return { success: false };
    }
  }

  /** Update issue fields on Jira (story points, due date, etc.) */
  async updateIssueFields(issueKey: string, fields: Record<string, unknown>): Promise<boolean> {
    try {
      console.log(`[Jira Flow] Updating ${issueKey} fields:`, fields);
      await this.request(`issue/${issueKey}`, "PUT", { fields });
      console.log(`[Jira Flow] Updated ${issueKey} successfully`);
      return true;
    } catch (e) {
      console.error(`[Jira Flow] Failed to update ${issueKey}:`, e);
      return false;
    }
  }

  /** Fetch full issue details */
  async fetchIssue(issueKey: string): Promise<JiraIssue | null> {
    try {
      return await this.request<JiraIssue>(
        `issue/${issueKey}?fields=summary,description,status,issuetype,priority,assignee,created,updated,duedate,labels,sprint,issuelinks,customfield_10016,customfield_10329`
      );
    } catch {
      return null;
    }
  }

  async downloadImage(url: string): Promise<ArrayBuffer> {
    const response = await requestUrl({
      url,
      headers: {
        Authorization: this.authHeader,
      },
    });
    return response.arrayBuffer;
  }
}
