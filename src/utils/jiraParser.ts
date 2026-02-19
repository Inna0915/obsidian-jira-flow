/**
 * Parses Jira Server/Data Center sprint field format.
 * Jira returns sprint as an array of Java toString() representations like:
 * ["com.atlassian.greenhopper.service.sprint.Sprint@...[id=123,name=Sprint 1,state=ACTIVE,...]"]
 */

/**
 * Extract sprint name from messy Jira Server sprint data
 */
export const parseJiraSprintName = (sprintFieldData: unknown): string => {
  if (!sprintFieldData) return "";

  // Jira returns an array of sprint strings
  const sprintArray = Array.isArray(sprintFieldData) ? sprintFieldData : [sprintFieldData];
  if (sprintArray.length === 0) return "";

  // Find active sprint first, otherwise use the last one (most recent)
  let targetSprint = sprintArray[sprintArray.length - 1];
  
  for (const sprintStr of sprintArray) {
    const str = String(sprintStr);
    if (str.includes("state=ACTIVE") || str.includes("state=active")) {
      targetSprint = sprintStr;
      break;
    }
  }

  const sprintString = String(targetSprint);

  // Extract content inside the brackets: [...]
  const match = sprintString.match(/\[(.*?)\]/);
  if (!match) {
    // If no brackets, return as-is (might be a normal string)
    return sprintString;
  }

  // Parse key=value pairs inside brackets
  const sprintData: Record<string, string> = {};
  const pairs = match[1].split(',');
  
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key) {
      const value = valueParts.join('='); // Handle values that contain '='
      sprintData[key.trim()] = value !== '<null>' && value !== 'null' ? value.trim() : '';
    }
  }

  return sprintData['name'] || "";
};

/**
 * Extract sprint state from messy Jira Server sprint data
 */
export const parseJiraSprintState = (sprintFieldData: unknown): string => {
  if (!sprintFieldData) return "";

  const sprintArray = Array.isArray(sprintFieldData) ? sprintFieldData : [sprintFieldData];
  if (sprintArray.length === 0) return "";

  // Find active sprint first
  let targetSprint = sprintArray[sprintArray.length - 1];
  
  for (const sprintStr of sprintArray) {
    const str = String(sprintStr);
    if (str.includes("state=ACTIVE") || str.includes("state=active")) {
      targetSprint = sprintStr;
      break;
    }
  }

  const sprintString = String(targetSprint);
  const match = sprintString.match(/\[(.*?)\]/);
  if (!match) return "";

  const sprintData: Record<string, string> = {};
  const pairs = match[1].split(',');
  
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key) {
      const value = valueParts.join('=');
      sprintData[key.trim()] = value !== '<null>' && value !== 'null' ? value.trim() : '';
    }
  }

  return sprintData['state'] || "";
};
