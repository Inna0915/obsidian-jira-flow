import React from 'react';
import { normalizePath, TFile } from 'obsidian';
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
  const resolveImageSource = (src: string): { kind: 'local' | 'jira' | 'direct'; value: string } => {
    if (!src) {
      return { kind: 'direct', value: src };
    }

    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('app://')) {
      return { kind: 'direct', value: src };
    }

    const localFile = plugin.app.vault.getAbstractFileByPath(normalizePath(src));
    if (localFile instanceof TFile) {
      return { kind: 'local', value: plugin.app.vault.getResourcePath(localFile) };
    }

    if (!plugin.settings.jiraHost) {
      return { kind: 'direct', value: src };
    }

    try {
      const jiraBase = new URL(plugin.settings.jiraHost);
      const imageUrl = src.startsWith('http') ? new URL(src) : new URL(src, jiraBase);
      if (imageUrl.origin === jiraBase.origin) {
        return { kind: 'jira', value: src };
      }
      return { kind: 'direct', value: imageUrl.toString() };
    } catch {
      return { kind: 'jira', value: src };
    }
  };

  const options: HTMLReactParserOptions = {
    replace: (domNode) => {
      if (domNode instanceof Element && domNode.name === 'img') {
        const { src, alt, class: className, width, height } = domNode.attribs;
        if (src) {
          const resolved = resolveImageSource(src);
          return (
            <JiraAuthImage
              src={resolved.value}
              alt={alt || 'Jira image'}
              className={className}
              width={width}
              height={height}
              authRequired={resolved.kind === 'jira'}
              plugin={plugin}
            />
          );
        }
      }

      if (domNode instanceof Element && domNode.name === 'table') {
        return (
          <div className="jf-my-3 jf-overflow-auto jf-rounded-lg jf-border jf-border-gray-200 jf-bg-white">
            <table
              style={{
                width: '100%',
                minWidth: '640px',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
              }}
            >
              {domToReact(domNode.children, options)}
            </table>
          </div>
        );
      }

      if (domNode instanceof Element && domNode.name === 'th') {
        return (
          <th
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB',
              color: '#374151',
              fontSize: '12px',
              fontWeight: 700,
              textAlign: 'left',
              verticalAlign: 'top',
            }}
          >
            {domToReact(domNode.children, options)}
          </th>
        );
      }

      if (domNode instanceof Element && domNode.name === 'td') {
        return (
          <td
            style={{
              padding: '12px',
              borderBottom: '1px solid #F3F4F6',
              color: '#1F2937',
              fontSize: '13px',
              lineHeight: '1.6',
              verticalAlign: 'top',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
          >
            {domToReact(domNode.children, options)}
          </td>
        );
      }

      if (domNode instanceof Element && domNode.name === 'p') {
        return (
          <p style={{ margin: '0 0 12px', lineHeight: '1.7', color: '#374151' }}>
            {domToReact(domNode.children, options)}
          </p>
        );
      }

      if (domNode instanceof Element && (domNode.name === 'ul' || domNode.name === 'ol')) {
        return React.createElement(
          domNode.name,
          {
            style: {
              margin: '0 0 12px',
              paddingLeft: '20px',
              color: '#374151',
              lineHeight: '1.7',
            },
          },
          domToReact(domNode.children, options)
        );
      }

      if (domNode instanceof Element && domNode.name === 'li') {
        return <li style={{ marginBottom: '6px' }}>{domToReact(domNode.children, options)}</li>;
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
    <div className="jf-max-w-none" style={{ fontSize: '14px' }}>
      {parse(html || '<i class="jf-text-gray-400">No description provided.</i>', options)}
    </div>
  );
};
