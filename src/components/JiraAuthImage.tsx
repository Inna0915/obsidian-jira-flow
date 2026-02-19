import React, { useState, useEffect } from 'react';
import { requestUrl, arrayBufferToBase64 } from 'obsidian';
import type JiraFlowPlugin from '../main';

interface JiraAuthImageProps {
  src: string;
  alt?: string;
  className?: string;
  plugin: JiraFlowPlugin;
}

export const JiraAuthImage: React.FC<JiraAuthImageProps> = ({ src, alt, className, plugin }) => {
  const [imgData, setImgData] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    const fetchImage = async () => {
      if (!src || !plugin.settings.jiraHost) return;
      
      // Skip non-Jira URLs (external images)
      if (src.startsWith('http') && !src.includes(plugin.settings.jiraHost)) {
        setImgData(src);
        return;
      }

      try {
        const fullUrl = src.startsWith('/') ? `${plugin.settings.jiraHost}${src}` : src;
        
        // Get auth token from JiraApi
        const authHeader = plugin.jiraApi.getAuthHeader();
        
        const response = await requestUrl({
          url: fullUrl,
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'User-Agent': 'Obsidian-Jira-Flow'
          }
        });

        // Use Obsidian's native mobile-safe base64 converter
        const base64 = arrayBufferToBase64(response.arrayBuffer);
        const mimeType = response.headers['content-type'] || 'image/png';
        
        setImgData(`data:${mimeType};base64,${base64}`);
      } catch (error) {
        console.error('[Jira Flow] Failed to fetch image:', error);
        setIsError(true);
      }
    };

    fetchImage();
  }, [src, plugin]);

  if (isError) return (
    <div className="jf-text-red-500 jf-text-xs jf-border jf-border-red-200 jf-p-2 jf-rounded">
      📷 Image failed to load
    </div>
  );
  
  if (!imgData) return (
    <div className="jf-animate-pulse jf-bg-gray-200 jf-w-full jf-h-32 jf-rounded jf-flex jf-items-center jf-justify-center jf-text-gray-400 jf-text-xs">
      Loading image...
    </div>
  );

  return (
    <>
      <img 
        src={imgData} 
        alt={alt} 
        className={`jf-cursor-zoom-in hover:jf-opacity-90 jf-transition-opacity jf-rounded-md jf-shadow-sm ${className || ''}`}
        onClick={() => setIsLightboxOpen(true)}
      />
      
      {/* Lightbox / Fullscreen Image */}
      {isLightboxOpen && (
        <div 
          className="jf-fixed jf-inset-0 jf-z-[9999] jf-bg-black/80 jf-backdrop-blur-sm jf-flex jf-items-center jf-justify-center jf-p-8"
          onClick={() => setIsLightboxOpen(false)}
        >
          <img 
            src={imgData} 
            alt="Fullscreen" 
            className="jf-max-w-full jf-max-h-full jf-object-contain jf-shadow-2xl jf-rounded-md"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
};
