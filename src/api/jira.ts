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

/** Allowed-value entry on a transition-screen field. */
export interface JiraFieldAllowedValue {
  id?: string;
  name?: string;
  value?: string;
  released?: boolean;
  archived?: boolean;
}

/** A single field that appears on a workflow transition screen. */
export interface JiraTransitionField {
  required: boolean;
  name: string;
  fieldId?: string;
  schema?: { type?: string; items?: string; system?: string; custom?: string };
  operations?: string[];
  allowedValues?: JiraFieldAllowedValue[];
}

/** A workflow transition, optionally with its on-screen field metadata. */
export interface JiraTransitionMeta {
  id: string;
  name: string;
  to: { name: string };
  fields: Record<string, JiraTransitionField>;
}

export interface JiraAssignableUser {
  name: string;
  displayName: string;
  emailAddress?: string;
  avatarUrl?: string;
}

export class JiraApi {
  private plugin: JiraFlowPlugin;
  private currentUserCache: JiraCurrentUser | null | undefined = undefined;

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
    const fields = `summary,description,status,issuetype,priority,assignee,reporter,created,updated,duedate,labels,issuelinks,attachment,${s.storyPointsField},${s.dueDateField},${s.sprintField}`;
    return fields;
  }

  private buildSyncJql(): string {
    const baseJql = (this.plugin.settings.jql || "").trim().replace(/\s+order\s+by[\s\S]*$/i, "").trim();
    const reporterJql = "reporter = currentUser() AND resolution = Unresolved";
    // A reopened issue can keep a stale resolution (e.g. status "In Progress" but
    // resolution still "Done"), which a `resolution = Unresolved` filter wrongly
    // drops — the card then stays archived and never reappears. Fetch the
    // assignee's active-by-status issues (statusCategory != Done) so reopened
    // bugs come back regardless of any lingering resolution.
    const reopenedJql = "assignee = currentUser() AND statusCategory != Done";

    const clauses: string[] = [];
    if (baseJql) {
      clauses.push(`(${baseJql})`);
    }
    if (!/reporter\s*=\s*currentUser\(\)/i.test(baseJql)) {
      clauses.push(`(${reporterJql})`);
    }
    if (!/statuscategory/i.test(baseJql)) {
      clauses.push(`(${reopenedJql})`);
    }
    if (clauses.length === 0) {
      clauses.push(`(${reopenedJql})`);
    }

    return `${clauses.join(" OR ")} ORDER BY created DESC`;
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
        const errBody = response.json as { errorMessages?: string[]; message?: string } | undefined;
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
    return new DOMParser().parseFromString(value, "text/html").documentElement.textContent || "";
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
        const errBody = response.json as { errorMessages?: string[]; message?: string } | undefined;
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
    if (this.currentUserCache !== undefined) {
      return this.currentUserCache;
    }

    try {
      const currentUser = await this.request<JiraCurrentUser>("myself");
      this.currentUserCache = currentUser;
      return currentUser;
    } catch (error) {
      console.error("[Jira Flow] Failed to fetch current user", error);
      this.currentUserCache = null;
      return null;
    }
  }

  private buildAssigneeField(currentUser: JiraCurrentUser): Record<string, string> | null {
    if (currentUser.accountId) {
      return { accountId: currentUser.accountId };
    }

    if (currentUser.name) {
      return { name: currentUser.name };
    }

    if (currentUser.key) {
      return { key: currentUser.key };
    }

    return null;
  }

  private getCurrentUserDisplayName(currentUser: JiraCurrentUser): string {
    return currentUser.displayName || currentUser.name || currentUser.emailAddress || currentUser.key || "";
  }

  async assignIssueToCurrentUser(issueKey: string): Promise<{ success: boolean; assigneeName?: string }> {
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      return { success: false };
    }

    const assignee = this.buildAssigneeField(currentUser);
    if (!assignee) {
      console.error("[Jira Flow] Current Jira user has no supported assignee identifier", currentUser);
      return { success: false };
    }

    const success = await this.updateIssueFields(issueKey, { assignee });
    if (!success) {
      return { success: false };
    }

    return {
      success: true,
      assigneeName: this.getCurrentUserDisplayName(currentUser),
    };
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
      const data = await this.request<{
        transitions: Array<{ id: string; name: string; to: { name: string } }>;
      }>(`issue/${issueKey}/transitions`);


      // Step 2: Match target transition
      // 2a: mapStatusToColumn match
      let target = data.transitions.find(
        (t) => mapStatusToColumn(t.to.name) === targetColumnId
      );

      // 2b: direct name match
      if (!target) {
        target = data.transitions.find(
          (t) => t.to.name.toUpperCase() === targetColumnId.toUpperCase()
        );
      }

      // 2c: partial keyword match
      if (!target) {
        const colLower = targetColumnId.toLowerCase();
        target = data.transitions.find(
          (t) => t.name.toLowerCase().includes(colLower) || t.to.name.toLowerCase().includes(colLower)
        );
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
      }

      try {
        await this.request(`issue/${issueKey}/transitions`, "POST", transitionBody);
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

  /**
   * Fetch the available transitions for an issue, including each transition's
   * on-screen field metadata (resolution / fixVersions / worklog / assignee ...).
   * A non-empty `fields` map means the transition has a screen the user must fill.
   */
  async getTransitions(issueKey: string): Promise<JiraTransitionMeta[]> {
    const data = await this.request<{ transitions: JiraTransitionMeta[] }>(
      `issue/${issueKey}/transitions?expand=transitions.fields`
    );
    return (data?.transitions || []).map((t) => ({
      id: t.id,
      name: t.name,
      to: t.to,
      fields: t.fields || {},
    }));
  }

  /**
   * Pick the transition that lands the issue in the requested kanban column.
   * Mirrors the matching used by transitionIssue (column map → status name → keyword).
   */
  pickTransition(transitions: JiraTransitionMeta[], targetColumnId: string): JiraTransitionMeta | undefined {
    let target = transitions.find((t) => mapStatusToColumn(t.to.name) === targetColumnId);
    if (!target) {
      target = transitions.find((t) => t.to.name.toUpperCase() === targetColumnId.toUpperCase());
    }
    if (!target) {
      const colLower = targetColumnId.toLowerCase();
      target = transitions.find(
        (t) => t.name.toLowerCase().includes(colLower) || t.to.name.toLowerCase().includes(colLower)
      );
    }
    return target;
  }

  /** Search users assignable to an issue (for the transition-screen assignee picker). */
  async searchAssignableUsers(issueKey: string, query: string): Promise<JiraAssignableUser[]> {
    try {
      const q = encodeURIComponent(query || "");
      const data = await this.request<Array<{
        name: string;
        displayName: string;
        emailAddress?: string;
        avatarUrls?: Record<string, string>;
      }>>(`user/assignable/search?issueKey=${issueKey}&username=${q}&maxResults=20`);
      return (data || []).map((u) => ({
        name: u.name,
        displayName: u.displayName,
        emailAddress: u.emailAddress,
        avatarUrl: u.avatarUrls?.["24x24"],
      }));
    } catch (e) {
      console.warn(`[Jira Flow] searchAssignableUsers failed for ${issueKey}:`, e);
      return [];
    }
  }

  /**
   * Execute a transition by id, submitting collected screen `fields` and `update`
   * (e.g. comment / worklog). Self-heals two common screen mismatches:
   *  - a required `resolution` that we didn't send → retry adding resolution=Done
   *  - a `resolution`/`comment` we sent that isn't on the screen → retry without it
   * Re-fetches the issue afterwards to report the actual landing status.
   */
  async submitTransition(
    issueKey: string,
    transitionId: string,
    fields: Record<string, unknown> = {},
    update: Record<string, unknown> = {}
  ): Promise<{ success: boolean; actualStatus?: string; actualColumn?: string; error?: string }> {
    const post = async (f: Record<string, unknown>, u: Record<string, unknown>) => {
      const body: Record<string, unknown> = { transition: { id: transitionId } };
      if (Object.keys(f).length > 0) body.fields = f;
      if (Object.keys(u).length > 0) body.update = u;
      await this.request(`issue/${issueKey}/transitions`, "POST", body);
    };

    try {
      try {
        await post(fields, update);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const lower = msg.toLowerCase();
        const notOnScreen = lower.includes("cannot be set") || lower.includes("not on the appropriate screen");

        // A comment that the screen rejects → drop it and retry.
        if (notOnScreen && lower.includes("comment") && update.comment) {
          const { comment, ...restUpdate } = update;
          await post(fields, restUpdate);
        } else if (notOnScreen && lower.includes("resolution") && fields.resolution) {
          // Resolution not on this screen → drop it and retry.
          const { resolution, ...restFields } = fields;
          await post(restFields, update);
        } else if (lower.includes("resolution") && !fields.resolution) {
          // Resolution required but we didn't send one → best-effort Done.
          await post({ ...fields, resolution: { name: "Done" } }, update);
        } else {
          throw e;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[Jira Flow] submitTransition ${issueKey}: ${msg}`);
      return { success: false, error: msg };
    }

    try {
      const updated = await this.request<{ fields: { status: { name: string } } }>(
        `issue/${issueKey}?fields=status`
      );
      const actualStatus = updated.fields.status.name;
      return { success: true, actualStatus, actualColumn: mapStatusToColumn(actualStatus) };
    } catch {
      return { success: true };
    }
  }

  /** Update issue fields on Jira (story points, due date, etc.) */
  async updateIssueFields(issueKey: string, fields: Record<string, unknown>): Promise<boolean> {
    try {
      await this.request(`issue/${issueKey}`, "PUT", { fields });
      return true;
    } catch (e) {
      console.error(`[Jira Flow] Failed to update ${issueKey}:`, e);
      return false;
    }
  }

  /** Fetch full issue details including remote links (Confluence/Wiki pages) */
  async fetchIssue(issueKey: string): Promise<JiraIssue & { remotelinks?: unknown[] } | null> {
    try {
      // Fire both requests concurrently for speed
      const [issue, remoteLinks] = await Promise.all([
        this.request<JiraIssue>(`issue/${issueKey}?fields=${this.fieldsParam}&expand=renderedFields`),
        // Catch errors on remotelink just in case the endpoint fails, returning empty array
        this.request<unknown[]>(`issue/${issueKey}/remotelink`).catch(() => [])
      ]);

      if (issue) {
        // Attach the remote links to our issue object
        (issue as JiraIssue & { remotelinks?: unknown[] }).remotelinks = remoteLinks;
      }
      return issue;
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
