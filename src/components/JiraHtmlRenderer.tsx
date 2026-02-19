import React from 'react';
import parse, { Element, HTMLReactParserOptions } from 'html-react-parser';
import { JiraAuthImage } from './JiraAuthImage';
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
      // Handle other Jira-specific HTML elements if needed
      if (domNode instanceof Element && domNode.name === 'a') {
        const { href, class: className } = domNode.attribs;
        // Make links open in external browser
        return (
          <a 
            href={href}
            className={className || 'jf-text-blue-600 hover:jf-underline'}
            onClick={(e) => {
              e.preventDefault();
              window.open(href, '_blank');
            }}
          >
            {domNode.children}
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
