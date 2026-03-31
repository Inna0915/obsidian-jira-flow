/**
 * Universal Sprint Name Parser
 * Handles Jira Agile API objects, Core API string arrays, and edge cases.
 */
interface SprintCandidate {
  id: number | null;
  index: number;
  name: string | null;
  raw: unknown;
  sequence: number | null;
  state: string | null;
}

const extractStringToken = (value: string, key: string): string | null => {
  const match = value.match(new RegExp(`${key}=(.*?)(?:,|$|\\])`));
  if (!match || !match[1]) {
    return null;
  }

  const normalized = match[1].trim();
  return normalized === '<null>' ? null : normalized;
};

const extractNumberToken = (value: string, key: string): number | null => {
  const token = extractStringToken(value, key);
  if (!token) {
    return null;
  }

  const parsed = Number(token);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSprintState = (state: unknown): string | null => {
  if (typeof state !== 'string') {
    return null;
  }

  const normalized = state.trim();
  if (!normalized || normalized === '<null>') {
    return null;
  }

  return normalized.toUpperCase();
};

const toSprintCandidate = (entry: unknown, index: number): SprintCandidate => {
  if (typeof entry === 'object' && entry !== null) {
    const sprint = entry as {
      id?: number | string;
      name?: string;
      sequence?: number | string;
      state?: string;
    };

    const id = sprint.id !== undefined ? Number(sprint.id) : null;
    const sequence = sprint.sequence !== undefined ? Number(sprint.sequence) : null;

    return {
      id: Number.isFinite(id) ? id : null,
      index,
      name: typeof sprint.name === 'string' && sprint.name.trim() ? sprint.name.trim() : null,
      raw: entry,
      sequence: Number.isFinite(sequence) ? sequence : null,
      state: normalizeSprintState(sprint.state),
    };
  }

  const sprintString = String(entry);
  return {
    id: extractNumberToken(sprintString, 'id'),
    index,
    name: extractStringToken(sprintString, 'name'),
    raw: entry,
    sequence: extractNumberToken(sprintString, 'sequence'),
    state: normalizeSprintState(extractStringToken(sprintString, 'state')),
  };
};

const getSprintPriority = (state: string | null): number => {
  if (state === 'ACTIVE') {
    return 3;
  }

  if (state === 'FUTURE') {
    return 2;
  }

  if (state === 'CLOSED') {
    return 1;
  }

  return 0;
};

const selectPreferredSprint = (sprintData: unknown): SprintCandidate | null => {
  const sprintArray = Array.isArray(sprintData) ? sprintData : [sprintData];
  if (sprintArray.length === 0) {
    return null;
  }

  return sprintArray
    .map((entry, index) => toSprintCandidate(entry, index))
    .reduce<SprintCandidate | null>((best, candidate) => {
      if (!best) {
        return candidate;
      }

      const priorityDiff = getSprintPriority(candidate.state) - getSprintPriority(best.state);
      if (priorityDiff !== 0) {
        return priorityDiff > 0 ? candidate : best;
      }

      const sequenceDiff = (candidate.sequence ?? Number.MIN_SAFE_INTEGER) - (best.sequence ?? Number.MIN_SAFE_INTEGER);
      if (sequenceDiff !== 0) {
        return sequenceDiff > 0 ? candidate : best;
      }

      const idDiff = (candidate.id ?? Number.MIN_SAFE_INTEGER) - (best.id ?? Number.MIN_SAFE_INTEGER);
      if (idDiff !== 0) {
        return idDiff > 0 ? candidate : best;
      }

      return candidate.index > best.index ? candidate : best;
    }, null);
};

export const parseJiraSprintName = (sprintData: unknown): string | null => {
  if (!sprintData) return null;

  try {
    const preferredSprint = selectPreferredSprint(sprintData);
    if (!preferredSprint) {
      return null;
    }

    if (preferredSprint.name) {
      return preferredSprint.name;
    }

    return typeof preferredSprint.raw === 'string' ? preferredSprint.raw : String(preferredSprint.raw);
  } catch (error) {
    console.error('[Jira Flow] Error parsing sprint name:', error, sprintData);
    return null;
  }
};

/**
 * Universal Sprint State Parser
 */
export const parseJiraSprintState = (sprintData: unknown): string | null => {
  if (!sprintData) return null;

  try {
    return selectPreferredSprint(sprintData)?.state ?? null;
  } catch (error) {
    console.error('[Jira Flow] Error parsing sprint state:', error);
    return null;
  }
};
