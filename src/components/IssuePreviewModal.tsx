import React, { useState, useEffect } from 'react';
import { JiraHtmlRenderer } from './JiraHtmlRenderer';
import type JiraFlowPlugin from '../main';

interface IssuePreviewModalProps {
  issueKey: string;
  plugin: JiraFlowPlugin;
  onClose: () => void;
}

export const IssuePreviewModal: React.FC<IssuePreviewModalProps> = ({ issueKey, plugin, onClose }) => {
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadIssue = async () => {
      setLoading(true);
      console.log(`[Jira Flow Preview] Loading issue: ${issueKey}`);
      
      // Fetch issue with renderedFields
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
        });
        
        // Run description through asset downloader
        const rawDesc = data.renderedFields?.description || data.fields?.description || "";
        console.log(`[Jira Flow Preview] Raw description (first 500 chars):`, rawDesc.substring(0, 500));
        
        const processedDesc = await plugin.fileManager.processDescription(rawDesc, issueKey);
        console.log(`[Jira Flow Preview] Processed description (first 500 chars):`, processedDesc.substring(0, 500));
        
        setIssue({ ...data, processedDesc });
      } else {
        console.error(`[Jira Flow Preview] Failed to load issue ${issueKey}`);
      }
      setLoading(false);
    };
    loadIssue();
  }, [issueKey, plugin]);

  return (
    <div className="jf-fixed jf-inset-0 jf-bg-black/40 jf-backdrop-blur-sm jf-z-[9999] jf-flex jf-items-center jf-justify-center jf-p-4" onClick={onClose}>
      <div className="jf-bg-white jf-rounded-xl jf-shadow-2xl jf-w-full jf-max-w-2xl jf-max-h-[85vh] jf-flex jf-flex-col jf-overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="jf-px-6 jf-py-4 jf-border-b jf-border-gray-100 jf-flex jf-justify-between jf-items-center jf-bg-gray-50">
          <h2 className="jf-text-lg jf-font-bold jf-text-gray-800">{issueKey} {issue?.fields?.summary && `- ${issue.fields.summary}`}</h2>
          <button onClick={onClose} className="jf-text-gray-500 hover:jf-text-gray-700 jf-text-xl jf-leading-none">&times;</button>
        </div>
        
        {/* Body */}
        <div className="jf-p-6 jf-overflow-y-auto">
          {loading ? (
            <div className="jf-flex jf-justify-center jf-py-10 jf-text-gray-500">Loading details from Jira...</div>
          ) : issue ? (
            <div className="jf-space-y-4">
              <div className="jf-flex jf-gap-4 jf-text-sm jf-text-gray-600">
                <span className="jf-bg-blue-50 jf-text-blue-700 jf-px-2 jf-py-1 jf-rounded">{issue.fields.status?.name}</span>
                <span className="jf-bg-gray-100 jf-px-2 jf-py-1 jf-rounded">{issue.fields.assignee?.displayName || 'Unassigned'}</span>
              </div>
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
            </div>
          ) : (
            <div className="jf-text-red-500 jf-text-center jf-py-10">Failed to load issue.</div>
          )}
        </div>
      </div>
    </div>
  );
};
