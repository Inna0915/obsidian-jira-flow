import { App, TFile } from 'obsidian';

/**
 * Search for a local Confluence/Wiki page in the vault by URL or pageId.
 * Local files should have frontmatter like:
 *   confluence_url: "http://.../viewpage.action?pageId=90801066"
 *   confluence_page_id: "90801066"
 */
export const openLocalWikiPage = async (app: App, targetUrl: string): Promise<boolean> => {
  try {
    const files = app.vault.getMarkdownFiles();
    let targetFile: TFile | null = null;
    
    // Attempt to extract pageId for robust matching
    let targetPageId: string | null = null;
    try {
      const urlObj = new URL(targetUrl);
      targetPageId = urlObj.searchParams.get('pageId');
    } catch (e) { /* ignore invalid URLs */ }

    for (const file of files) {
      const cache = app.metadataCache.getFileCache(file);
      if (cache?.frontmatter) {
        const fmUrl = cache.frontmatter['confluence_url'];
        const fmPageId = cache.frontmatter['confluence_page_id'];

        // Match by exact URL OR by extracted pageId
        if (
          (fmUrl && fmUrl === targetUrl) || 
          (targetPageId && fmPageId && String(fmPageId) === String(targetPageId))
        ) {
          targetFile = file;
          break;
        }
      }
    }

    if (targetFile) {
      // Open natively in a new tab
      const leaf = app.workspace.getLeaf('tab');
      await leaf.openFile(targetFile);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Jira Flow] Failed to open local wiki:', error);
    return false;
  }
};
