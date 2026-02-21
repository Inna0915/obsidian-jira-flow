import React, { useState, useEffect } from 'react';
import { TFile } from 'obsidian';
import { JiraHtmlRenderer } from './JiraHtmlRenderer';
import type JiraFlowPlugin from '../main';

interface IssuePreviewModalProps {
  issueKey: string;
  plugin: JiraFlowPlugin;
  onClose: () => void;
}

// ===== Sub-Components =====

const LinkedIssueItem = ({ link, onIssueClick }: { link: any, onIssueClick: (key: string) => void }) => {
  const isOutward = !!link.outwardIssue;
  const targetIssue = link.outwardIssue || link.inwardIssue;
  
  if (!targetIssue) return null;

  const relationText = isOutward ? link.type?.outward : link.type?.inward;
  const issueKey = targetIssue.key;
  const summary = targetIssue.fields?.summary || "Unknown Issue";
  const statusName = targetIssue.fields?.status?.name || "UNKNOWN";
  const isDone = targetIssue.fields?.status?.statusCategory?.key === 'done';

  return (
    <div className="jf-flex jf-flex-col jf-mb-2">
      <span className="jf-text-[11px] jf-font-semibold jf-text-gray-500 jf-mb-1 jf-capitalize">
        {relationText || 'Linked'}
      </span>
      <div 
        onClick={() => onIssueClick(issueKey)}
        className="jf-flex jf-items-center jf-justify-between jf-p-2 jf-bg-gray-50 hover:jf-bg-gray-100 jf-border jf-border-gray-200 jf-rounded-md jf-transition-colors jf-cursor-pointer jf-group"
      >
        <div className="jf-flex jf-items-center jf-gap-3 jf-overflow-hidden">
          <span className={`jf-text-xs jf-font-mono jf-px-1.5 jf-py-0.5 jf-rounded ${isDone ? 'jf-bg-green-100 jf-text-green-700' : 'jf-bg-blue-100 jf-text-blue-700'}`}>
            {issueKey}
          </span>
          <span className={`jf-text-sm jf-font-medium jf-truncate group-hover:jf-text-blue-600 ${isDone ? 'jf-line-through jf-text-gray-400' : 'jf-text-gray-700'}`}>
            {summary}
          </span>
        </div>
        <span className="jf-ml-2 jf-shrink-0 jf-text-[10px] jf-font-bold jf-text-gray-500 jf-bg-gray-200 jf-px-2 jf-py-1 jf-rounded jf-uppercase">
          {statusName}
        </span>
      </div>
    </div>
  );
};

const RemoteLinkItem = ({ link, plugin }: { link: any, plugin: JiraFlowPlugin }) => {
  const [localFile, setLocalFile] = useState<TFile | null>(null);
  const [displayTitle, setDisplayTitle] = useState(link.object?.title || "Wiki Page");
  const url = link.object?.url;

  useEffect(() => {
    if (!url) return;
    let targetPageId: string | null = null;
    try {
      targetPageId = new URL(url).searchParams.get('pageId');
    } catch (e) {}

    const files = plugin.app.vault.getMarkdownFiles();
    for (const file of files) {
      const cache = plugin.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter) {
        const fmUrl = cache.frontmatter['confluence_url'];
        const fmPageId = cache.frontmatter['confluence_page_id'];
        
        if ((fmUrl && fmUrl === url) || (targetPageId && fmPageId && String(fmPageId) === String(targetPageId))) {
          setLocalFile(file);
          setDisplayTitle(cache.frontmatter['title'] || file.basename);
          return;
        }
      }
    }
  }, [url, plugin]);

  const openLocal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (localFile) {
      const leaf = plugin.app.workspace.getLeaf('tab');
      await leaf.openFile(localFile);
    }
  };

  const openWeb = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank');
  };

  return (
    <div className="jf-flex jf-flex-col jf-mb-2">
      <span className="jf-text-[11px] jf-font-semibold jf-text-gray-500 jf-mb-1 jf-capitalize">
        {link.relationship || 'External Link'}
      </span>
      <div className="jf-flex jf-items-center jf-p-2 jf-bg-blue-50/50 hover:jf-bg-blue-50 jf-border jf-border-blue-100 jf-rounded-md jf-transition-colors jf-group">
        
        {/* Primary Click Area */}
        <div 
          onClick={localFile ? openLocal : openWeb}
          className="jf-flex jf-items-center jf-gap-2 jf-flex-1 jf-cursor-pointer jf-overflow-hidden"
        >
          <span className="jf-text-blue-600 jf-text-base jf-shrink-0">
            {localFile ? '📘' : '🔗'}
          </span>
          <span className="jf-text-sm jf-font-medium jf-text-blue-700 group-hover:jf-text-blue-800 jf-truncate">
            {displayTitle}
          </span>
          {localFile && (
            <span className="jf-shrink-0 jf-text-[10px] jf-bg-blue-100 jf-text-blue-600 jf-px-1.5 jf-py-0.5 jf-rounded">Local</span>
          )}
        </div>

        {/* Secondary Web Action (Always available if it's a local file) */}
        {localFile && (
          <button 
            onClick={openWeb}
            title="Open in Web Browser"
            className="jf-ml-2 jf-p-1 jf-text-gray-400 hover:jf-text-blue-600 hover:jf-bg-blue-100 jf-rounded jf-transition-colors"
          >
            <svg className="jf-w-4 jf-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
          </button>
        )}
      </div>
    </div>
  );
};

// ===== Main Component =====

export const IssuePreviewModal: React.FC<IssuePreviewModalProps> = ({ issueKey: initialIssueKey, plugin, onClose }) => {
  const [issueKey, setIssueKey] = useState(initialIssueKey);
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Update issueKey when prop changes
  useEffect(() => {
    setIssueKey(initialIssueKey);
  }, [initialIssueKey]);

  useEffect(() => {
    const loadIssue = async () => {
      setLoading(true);
      console.log(`[Jira Flow Preview] Loading issue: ${issueKey}`);
      
      // Fetch issue with renderedFields and remote links
      const data = await plugin.jiraApi.fetchIssue(issueKey); 
      
      console.log(`[Jira Flow Preview] API Response for ${issueKey}:`, data);
      
      if (data) {
        // Log key fields
        console.log(`[Jira Flow Preview] Issue ${issueKey} fields:`, {
          summary: data.fields?.summary,
          status: data.fields?.status?.name,
          assignee: data.fields?.assignee?.displayName,
          issuetype: data.fields?.issuetype?.name,
          priority: data.fields?.priority?.name,
          descriptionLength: data.fields?.description?.length || 0,
          renderedDescriptionLength: data.renderedFields?.description?.length || 0,
          remoteLinksCount: data.remotelinks?.length || 0,
          issueLinksCount: data.fields?.issuelinks?.length || 0,
        });
        
        // Run description through asset downloader
        const rawDesc = data.renderedFields?.description || data.fields?.description || "";
        const processedDesc = await plugin.fileManager.processDescription(rawDesc, issueKey);
        
        setIssue({ ...data, processedDesc });
      } else {
        console.error(`[Jira Flow Preview] Failed to load issue ${issueKey}`);
      }
      setLoading(false);
    };
    loadIssue();
  }, [issueKey, plugin]);

  const handleLinkedIssueClick = (clickedKey: string) => {
    console.log(`[Jira Flow Preview] Navigating to linked issue: ${clickedKey}`);
    setIssueKey(clickedKey);
  };

  return (
    <div className="jf-fixed jf-inset-0 jf-bg-black/40 jf-backdrop-blur-sm jf-z-[9999] jf-flex jf-items-center jf-justify-center jf-p-4" onClick={onClose}>
      <div className="jf-bg-white jf-rounded-xl jf-shadow-2xl jf-w-full jf-max-w-2xl jf-max-h-[85vh] jf-flex jf-flex-col jf-overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="jf-px-6 jf-py-4 jf-border-b jf-border-gray-100 jf-flex jf-justify-between jf-items-center jf-bg-gray-50">
          <div className="jf-flex jf-items-center jf-gap-2">
            {issueKey !== initialIssueKey && (
              <button 
                onClick={() => setIssueKey(initialIssueKey)}
                className="jf-mr-2 jf-p-1 jf-text-gray-500 hover:jf-text-blue-600 hover:jf-bg-blue-50 jf-rounded jf-transition-colors"
                title="Back to initial issue"
              >
                <svg className="jf-w-5 jf-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              </button>
            )}
            <h2 className="jf-text-lg jf-font-bold jf-text-gray-800">{issueKey} {issue?.fields?.summary && `- ${issue.fields.summary}`}</h2>
          </div>
          <button onClick={onClose} className="jf-text-gray-500 hover:jf-text-gray-700 jf-text-xl jf-leading-none">&times;</button>
        </div>
        
        {/* Body */}
        <div className="jf-p-6 jf-overflow-y-auto">
          {loading ? (
            <div className="jf-flex jf-justify-center jf-py-10 jf-text-gray-500">Loading details from Jira...</div>
          ) : issue ? (
            <div className="jf-space-y-4">
              {/* Status & Assignee */}
              <div className="jf-flex jf-gap-4 jf-text-sm jf-text-gray-600">
                <span className="jf-bg-blue-50 jf-text-blue-700 jf-px-2 jf-py-1 jf-rounded">{issue.fields.status?.name}</span>
                <span className="jf-bg-gray-100 jf-px-2 jf-py-1 jf-rounded">{issue.fields.assignee?.displayName || 'Unassigned'}</span>
              </div>
              
              {/* Description Section */}
              <div className="jf-mt-4">
                <h3 className="jf-text-xs jf-font-bold jf-text-gray-400 jf-uppercase jf-mb-2">Description</h3>
                <div className="jf-bg-gray-50 jf-p-4 jf-rounded-lg">
                  {issue.processedDesc ? (
                    <JiraHtmlRenderer html={issue.processedDesc} plugin={plugin} />
                  ) : (
                    <span className="jf-text-gray-400">No description provided.</span>
                  )}
                </div>
              </div>

              {/* Linked Issues Section */}
              {issue.fields?.issuelinks?.length > 0 && (
                <div className="jf-mt-6 jf-border-t jf-border-gray-100 jf-pt-4">
                  <h3 className="jf-text-xs jf-font-bold jf-text-gray-800 jf-uppercase jf-mb-3 jf-flex jf-items-center jf-gap-1">
                    Linked Issues
                  </h3>
                  <div className="jf-flex jf-flex-col">
                    {issue.fields.issuelinks.map((link: any) => (
                      <LinkedIssueItem 
                        key={link.id} 
                        link={link} 
                        onIssueClick={handleLinkedIssueClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Remote / Confluence Links Section */}
              {issue.remotelinks?.length > 0 && (
                <div className="jf-mt-6 jf-border-t jf-border-gray-100 jf-pt-4">
                  <h3 className="jf-text-xs jf-font-bold jf-text-gray-800 jf-uppercase jf-mb-3 jf-flex jf-items-center jf-gap-1">
                    Confluence Pages
                  </h3>
                  <div className="jf-flex jf-flex-col">
                    {issue.remotelinks.map((link: any) => (
                      <RemoteLinkItem key={link.id || link.object?.url} link={link} plugin={plugin} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="jf-text-red-500 jf-text-center jf-py-10">Failed to load issue.</div>
          )}
        </div>
      </div>
    </div>
  );
};
