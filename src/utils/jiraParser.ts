/**
 * Universal Sprint Name Parser
 * Handles Jira Agile API objects, Core API string arrays, and edge cases.
 */
export const parseJiraSprintName = (sprintData: unknown): string | null => {
  if (!sprintData) return null;

  try {
    // Case 1: It's already a clean object (Agile API format)
    if (typeof sprintData === 'object' && !Array.isArray(sprintData) && (sprintData as {name?: string}).name) {
      return (sprintData as {name: string}).name;
    }

    // Convert to array to handle historical sprints
    const sprintArray = Array.isArray(sprintData) ? sprintData : [sprintData];
    if (sprintArray.length === 0) return null;

    // Get the most recent sprint (usually the last one in the array)
    const latestSprint = sprintArray[sprintArray.length - 1];

    // Case 2: Array of clean objects
    if (typeof latestSprint === 'object' && latestSprint !== null && (latestSprint as {name?: string}).name) {
      return (latestSprint as {name: string}).name;
    }

    // Case 3: Ugly Jira Server String (Core API format)
    const sprintString = String(latestSprint);
    
    // Improved Regex: specifically look for 'name=VALUE' followed by a comma or closing bracket
    const nameMatch = sprintString.match(/name=(.*?)(?:,|$|\])/);
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1].trim() === '<null>' ? null : nameMatch[1].trim();
    }

    // Fallback: If regex fails, return the string itself so the user at least sees something instead of nothing
    return sprintString; 
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
    if (typeof sprintData === 'object' && !Array.isArray(sprintData) && (sprintData as {state?: string}).state) {
      return (sprintData as {state: string}).state;
    }

    const sprintArray = Array.isArray(sprintData) ? sprintData : [sprintData];
    if (sprintArray.length === 0) return null;

    const latestSprint = sprintArray[sprintArray.length - 1];

    if (typeof latestSprint === 'object' && latestSprint !== null && (latestSprint as {state?: string}).state) {
      return (latestSprint as {state: string}).state;
    }

    const sprintString = String(latestSprint);
    const stateMatch = sprintString.match(/state=(.*?)(?:,|$|\])/);
    if (stateMatch && stateMatch[1]) {
      return stateMatch[1].trim() === '<null>' ? null : stateMatch[1].trim().toUpperCase();
    }

    return null;
  } catch (error) {
    console.error('[Jira Flow] Error parsing sprint state:', error);
    return null;
  }
};
