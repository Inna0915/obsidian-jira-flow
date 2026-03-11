import { requestUrl, type RequestUrlParam } from "obsidian";
import type JiraFlowPlugin from "../main";
import { mapStatusToColumn } from "../types";
import type { JiraBoard, JiraIssue, JiraSearchResponse, JiraSprint } from "../types";

interface JiraCreateMetaResponse {
  projects: Array<{
    key: string;
    name: string;
    issuetypes: Array<{
      id: string;
      name: string;
      fields?: {
        priority?: {
          allowedValues?: Array<{ id: string; name: string }>;
        };
      };
    }>;
  }>;
}

interface JiraQuickCreateResponse {
  fields?: Array<{
    id: string;
    label?: string;
    required?: boolean;
    editHtml?: string;
  }>;
}

interface JiraQuickCreateSuggestionItem {
  label: string;
  value: string;
  selected?: boolean;
}

interface JiraQuickCreateSuggestionGroup {
  label: string;
  items: JiraQuickCreateSuggestionItem[];
}

interface JiraCurrentUser {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
  name?: string;
  key?: string;
}

export interface JiraCreateIssueMeta {
  projectKey: string;
  projectName: string;
  issueTypes: Array<{ id: string; name: string }>;
  priorities: Array<{ id: string; name: string }>;
}

export interface JiraCreateIssueInput {
  projectKey: string;
  issueTypeId: string;
  summary: string;
  description?: string;
  assignee?: string;
  priorityId?: string;
  storyPoints?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

export class JiraApi {
  private plugin: JiraFlowPlugin;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
  }

  getAuthHeader(): string {
    const { jiraUsername, jiraPassword } = this.plugin.settings;
    return "Basic " + btoa(`${jiraUsername}:${jiraPassword}`);
  }

  private get baseUrl(): string {
    return this.plugin.settings.jiraHost.replace(/\/+$/, "");
  }

  private get fieldsParam(): string {
    const s = this.plugin.settings;
    const fields = `summary,description,status,issuetype,priority,assignee,reporter,created,updated,duedate,labels,issuelinks,${s.storyPointsField},${s.dueDateField},${s.sprintField}`;
    return fields;
  }

  private buildSyncJql(): string {
    const baseJql = (this.plugin.settings.jql || "").trim().replace(/\s+order\s+by[\s\S]*$/i, "").trim();
    const reporterJql = "reporter = currentUser() AND resolution = Unresolved";
    if (!baseJql) {
      return `${reporterJql} ORDER BY created DESC`;
    }

    if (/reporter\s*=\s*currentUser\(\)/i.test(baseJql)) {
      return baseJql;
    }

    return `(${baseJql}) OR (${reporterJql}) ORDER BY created DESC`;
  }

  private async request<T>(endpoint: string, method = "GET", body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/rest/api/2/${endpoint}`;
    return this.requestAbsoluteUrl<T>(url, method, body, {
      "Content-Type": "application/json",
      Accept: "application/json",
    });
  }

  private async requestAbsoluteUrl<T>(
    url: string,
    method = "GET",
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const params: RequestUrlParam = {
      url,
      method,
      headers: {
        Authorization: this.getAuthHeader(),
        "X-Atlassian-Token": "no-check",
        "User-Agent": "Obsidian-Jira-Flow",
        ...extraHeaders,
      },
      throw: false,
    };

    if (body !== undefined) {
      params.body = typeof body === "string" ? body : JSON.stringify(body);
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

  private decodeHtmlEntities(value: string): string {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  private extractDataAttribute(html: string, elementId: string, attributeName: string): string | null {
    const pattern = new RegExp(`<[^>]*id=["']${elementId}["'][^>]*${attributeName}=["']([^"']*)["']`, "i");
    const match = html.match(pattern);
    return match ? this.decodeHtmlEntities(match[1]) : null;
  }

  private extractScriptJson(html: string, scriptId: string): string | null {
    const pattern = new RegExp(`<script[^>]*id=["']${scriptId}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i");
    const match = html.match(pattern);
    return match ? this.decodeHtmlEntities(match[1].trim()) : null;
  }

  private parseSuggestions(html: string, elementId: string): JiraQuickCreateSuggestionGroup[] {
    const raw = this.extractDataAttribute(html, elementId, "data-suggestions");
    if (!raw) return [];

    try {
      return JSON.parse(raw) as JiraQuickCreateSuggestionGroup[];
    } catch (error) {
      console.error(`[Jira Flow] Failed to parse suggestions for ${elementId}`, error);
      return [];
    }
  }

  private parseProjectLabel(label: string): { name: string; key: string } {
    const match = label.match(/^(.*)\(([^()]+)\)\s*$/);
    if (!match) {
      return { name: label.trim(), key: label.trim() };
    }

    return {
      name: match[1].trim(),
      key: match[2].trim(),
    };
  }

  private parsePriorityOptions(html: string): Array<{ id: string; name: string }> {
    const options = Array.from(html.matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi));
    return options
      .map((match) => ({
        id: this.decodeHtmlEntities(match[1]).trim(),
        name: this.decodeHtmlEntities(match[2]).replace(/\s+/g, " ").trim(),
      }))
      .filter((item) => item.id && item.name);
  }

  private async fetchCreateIssueMetaFromQuickCreate(projectKey: string): Promise<JiraCreateIssueMeta> {
    const url = `${this.baseUrl}/secure/QuickCreateIssue!default.jspa?decorator=none`;
    const response = await this.requestAbsoluteUrl<JiraQuickCreateResponse>(url, "GET", undefined, {
      Accept: "application/json, text/plain, */*",
    });

    const fields = response?.fields || [];
    const projectField = fields.find((field) => field.id === "project")?.editHtml || "";
    const issueTypeField = fields.find((field) => field.id === "issuetype")?.editHtml || "";
    const priorityField = fields.find((field) => field.id === "priority")?.editHtml || "";

    const projectGroups = this.parseSuggestions(projectField, "project-options");
    const projects = projectGroups.flatMap((group) => group.items).map((item) => {
      const parsed = this.parseProjectLabel(item.label);
      return {
        id: item.value,
        key: parsed.key,
        name: parsed.name,
        selected: !!item.selected,
      };
    });

    const project =
      projects.find((item) => item.key === projectKey) ||
      projects.find((item) => item.selected) ||
      projects[0];

    if (!project) {
      throw new Error("QuickCreateIssue 未返回可用项目。请确认 Jira 权限和项目配置。");
    }

    const issueTypeGroups = this.parseSuggestions(issueTypeField, "issuetype-options");
    const projectTypeMapRaw = this.extractScriptJson(issueTypeField, "issuetype-projects");
    const issueTypeDefaultsRaw = this.extractScriptJson(issueTypeField, "issuetype-defaults");

    let projectTypeMap: Record<string, string> = {};
    let issueTypeDefaults: Record<string, string> = {};

    try {
      projectTypeMap = projectTypeMapRaw ? JSON.parse(projectTypeMapRaw) as Record<string, string> : {};
      issueTypeDefaults = issueTypeDefaultsRaw ? JSON.parse(issueTypeDefaultsRaw) as Record<string, string> : {};
    } catch (error) {
      console.error("[Jira Flow] Failed to parse QuickCreate issue type metadata", error);
    }

    const issueTypeGroupId = projectTypeMap[project.id];
    const issueTypes = issueTypeGroups
      .filter((group) => !issueTypeGroupId || group.label === issueTypeGroupId)
      .flatMap((group) => group.items)
      .map((item) => ({ id: item.value, name: item.label }));

    const priorities = this.parsePriorityOptions(priorityField);
    if (issueTypes.length === 0) {
      throw new Error(`QuickCreateIssue 未返回项目 ${project.key} 的问题类型。`);
    }

    const defaultIssueTypeId = issueTypeGroupId ? issueTypeDefaults[issueTypeGroupId] : undefined;
    const orderedIssueTypes = defaultIssueTypeId
      ? [
          ...issueTypes.filter((item) => item.id === defaultIssueTypeId),
          ...issueTypes.filter((item) => item.id !== defaultIssueTypeId),
        ]
      : issueTypes;

    return {
      projectKey: project.key,
      projectName: project.name,
      issueTypes: orderedIssueTypes,
      priorities,
    };
  }

  private async agileRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}/rest/agile/1.0/${endpoint}`;
    const response = await requestUrl({
      url,
      method: "GET",
      headers: {
        Authorization: this.getAuthHeader(),
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

  async getCurrentUser(): Promise<JiraCurrentUser | null> {
    try {
      return await this.request<JiraCurrentUser>("myself");
    } catch (error) {
      console.error("[Jira Flow] Failed to fetch current user", error);
      return null;
    }
  }

  async fetchCreateIssueMeta(projectKey: string): Promise<JiraCreateIssueMeta> {
    try {
      const data = await this.request<JiraCreateMetaResponse>(
        `issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&expand=projects.issuetypes.fields`
      );

      const project = data.projects?.[0];
      if (!project) {
        throw new Error(`No Jira project metadata found for ${projectKey}.`);
      }

      const issueTypes = project.issuetypes.map((issuetype) => ({
        id: issuetype.id,
        name: issuetype.name,
      }));

      const priorityMap = new Map<string, { id: string; name: string }>();
      for (const issuetype of project.issuetypes) {
        for (const priority of issuetype.fields?.priority?.allowedValues || []) {
          if (!priorityMap.has(priority.id)) {
            priorityMap.set(priority.id, { id: priority.id, name: priority.name });
          }
        }
      }

      let priorities = Array.from(priorityMap.values());
      if (priorities.length === 0) {
        priorities = await this.request<Array<{ id: string; name: string }>>("priority");
      }

      return {
        projectKey: project.key,
        projectName: project.name,
        issueTypes,
        priorities,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("status 404")) {
        throw error;
      }

      console.warn("[Jira Flow] createmeta unavailable, falling back to QuickCreateIssue metadata");
      return this.fetchCreateIssueMetaFromQuickCreate(projectKey);
    }
  }

  async createIssue(input: JiraCreateIssueInput): Promise<{ key: string; id: string }> {
    const fields: Record<string, unknown> = {
      project: { key: input.projectKey },
      issuetype: { id: input.issueTypeId },
      summary: input.summary,
    };

    if (input.description?.trim()) {
      fields.description = input.description.trim();
    }

    if (input.assignee?.trim()) {
      fields.assignee = { name: input.assignee.trim() };
    }

    if (input.priorityId) {
      fields.priority = { id: input.priorityId };
    }

    if (this.plugin.settings.storyPointsField && typeof input.storyPoints === "number") {
      fields[this.plugin.settings.storyPointsField] = input.storyPoints;
    }

    if (this.plugin.settings.plannedStartDateField && input.plannedStartDate) {
      fields[this.plugin.settings.plannedStartDateField] = input.plannedStartDate;
    }

    if (this.plugin.settings.dueDateField && input.plannedEndDate) {
      fields[this.plugin.settings.dueDateField] = input.plannedEndDate;
    }

    return await this.request<{ key: string; id: string }>("issue", "POST", { fields });
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
        `sprint/${sprintId}/issue?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=${this.fieldsParam}&expand=renderedFields`
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
          `board/${boardId}/backlog?startAt=${startAt}&maxResults=${maxResults}&jql=${encodeURIComponent(`project="${projectKey}" AND assignee=currentUser()`)}&fields=${this.fieldsParam}&expand=renderedFields`
        );
        // Filter out issues that already have a sprint (avoid duplicates)
        // Handle sprint as array - check if array is empty or null
        const sprintField = this.plugin.settings.sprintField;
        const backlogOnly = data.issues.filter((issue) => {
          const sprint = issue.fields[sprintField as keyof typeof issue.fields];
          if (!sprint) return true;
          if (Array.isArray(sprint)) return sprint.length === 0;
          return false;
        });
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
    const maxResults = 100;
    const jql = this.buildSyncJql();

    while (true) {
      const data = await this.request<JiraSearchResponse>(
        `search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=${this.fieldsParam}&expand=renderedFields`
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

  /** Fetch full issue details including remote links (Confluence/Wiki pages) */
  async fetchIssue(issueKey: string): Promise<JiraIssue & { remotelinks?: any[] } | null> {
    try {
      // Fire both requests concurrently for speed
      const [issue, remoteLinks] = await Promise.all([
        this.request<JiraIssue>(`issue/${issueKey}?fields=${this.fieldsParam}&expand=renderedFields`),
        // Catch errors on remotelink just in case the endpoint fails, returning empty array
        this.request<any[]>(`issue/${issueKey}/remotelink`).catch(() => []) 
      ]);

      if (issue) {
        // Attach the remote links to our issue object
        (issue as JiraIssue & { remotelinks?: any[] }).remotelinks = remoteLinks;
        console.log(`[Jira Flow] Fetched ${remoteLinks.length} remote links for ${issueKey}`);
      }
      return issue as JiraIssue & { remotelinks?: any[] };
    } catch (error) {
      console.error(`[Jira Flow] Failed to fetch issue ${issueKey}`, error);
      return null;
    }
  }

  async downloadImage(url: string): Promise<ArrayBuffer> {
    const response = await requestUrl({
      url,
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });
    return response.arrayBuffer;
  }
}
