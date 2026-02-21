import React from 'react';
import parse, { Element, HTMLReactParserOptions, domToReact } from 'html-react-parser';
import { JiraAuthImage } from './JiraAuthImage';
import { openLocalWikiPage } from '../utils/linkHandler';
import type JiraFlowPlugin from '../main';

interface JiraHtmlRendererProps {
  html: string;
  plugin: JiraFlowPlugin;
}

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

        return (
          <a 
            href={href} 
            className="jf-text-blue-600 hover:jf-underline jf-cursor-pointer"
            onClick={async (e) => {
              e.preventDefault();
              
              // If it looks like a Confluence link
              if (href.includes('viewpage.action') || href.includes('confluence')) {
                 const opened = await openLocalWikiPage(plugin.app, href);
                 if (!opened) window.open(href, '_blank'); // Fallback to external
              } else {
                 window.open(href, '_blank'); // Regular external link
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
