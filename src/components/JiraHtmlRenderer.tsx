import React from 'react';
import { TFile } from 'obsidian';
import parse, { Element, HTMLReactParserOptions, domToReact } from 'html-react-parser';
import { JiraAuthImage } from './JiraAuthImage';
import { openLocalWikiPage } from '../utils/linkHandler';
import type JiraFlowPlugin from '../main';

interface JiraHtmlRendererProps {
  html: string;
  plugin: JiraFlowPlugin;
}

// Helper function to find local wiki file synchronously (using cached data)
const findLocalWikiFile = (plugin: JiraFlowPlugin, href: string): TFile | null => {
  try {
    let targetPageId: string | null = null;
    try {
      targetPageId = new URL(href).searchParams.get('pageId');
    } catch (e) {}

    const files = plugin.app.vault.getMarkdownFiles();
    for (const file of files) {
      const cache = plugin.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter) {
        const fmUrl = cache.frontmatter['confluence_url'];
        const fmPageId = cache.frontmatter['confluence_page_id'];
        if ((fmUrl && fmUrl === href) || (targetPageId && fmPageId && String(fmPageId) === String(targetPageId))) {
          return file;
        }
      }
    }
  } catch (e) {
    console.error('[Jira Flow] Error finding local wiki file:', e);
  }
  return null;
};

export const JiraHtmlRenderer: React.FC<JiraHtmlRendererProps> = ({ html, plugin }) => {
  const options: HTMLReactParserOptions = {
    replace: (domNode) => {
      if (domNode instanceof Element && domNode.name === 'img') {
        const { src, alt, class: className } = domNode.attribs;
        if (src) {
          // Intercept and replace with authenticated image component
          return <JiraAuthImage src={src} alt={alt} className={className} plugin={plugin} />;
        }
      }
      
      // Handle links - intercept Confluence links
      if (domNode instanceof Element && domNode.name === 'a') {
        const href = domNode.attribs.href;
        if (!href) return;

        // Pre-check if this is a Confluence link to enable hover
        const isConfluenceLink = href.includes('viewpage.action') || href.includes('confluence');

        return (
          <a 
            href={href} 
            className="jf-text-blue-600 hover:jf-underline jf-cursor-pointer"
            onClick={async (e) => {
              e.preventDefault();
              
              // If it looks like a Confluence link
              if (isConfluenceLink) {
                 const opened = await openLocalWikiPage(plugin.app, href);
                 if (!opened) window.open(href, '_blank'); // Fallback to external
              } else {
                 window.open(href, '_blank'); // Regular external link
              }
            }}
            onMouseEnter={(e) => {
              // Only handle Confluence links for hover preview
              if (!isConfluenceLink) return;
              
              // Find local file synchronously using cached metadata
              const matchedFile = findLocalWikiFile(plugin, href);
              
              // Trigger native hover if found
              if (matchedFile && plugin?.app) {
                plugin.app.workspace.trigger('hover-link', {
                  event: e.nativeEvent,
                  source: 'jira-flow-preview',
                  hoverParent: e.currentTarget,
                  targetEl: e.currentTarget,
                  linktext: matchedFile.path,
                  sourcePath: '',
                });
              }
            }}
          >
            {domToReact(domNode.children, options)}
          </a>
        );
      }
    }
  };

  return (
    <div className="jf-prose jf-prose-sm jf-max-w-none jf-prose-blue">
      {parse(html || '<i class="jf-text-gray-400">No description provided.</i>', options)}
    </div>
  );
};
