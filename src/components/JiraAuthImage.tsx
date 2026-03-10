import React, { useState, useEffect } from 'react';
import { requestUrl, arrayBufferToBase64 } from 'obsidian';
import type JiraFlowPlugin from '../main';

interface JiraAuthImageProps {
  src: string;
  alt?: string;
  className?: string;
  width?: string;
  height?: string;
  authRequired?: boolean;
  plugin: JiraFlowPlugin;
}

export const JiraAuthImage: React.FC<JiraAuthImageProps> = ({
  src,
  alt,
  className,
  width,
  height,
  authRequired = true,
  plugin,
}) => {
  const [imgData, setImgData] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    const fetchImage = async () => {
      if (!src) return;

      if (!authRequired) {
        setImgData(src);
        return;
      }

      if (!plugin.settings.jiraHost) return;

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

    setImgData(null);
    setIsError(false);
    fetchImage();
  }, [authRequired, src, plugin]);

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
      <div className="jf-my-3">
        <div
          className="jf-relative jf-inline-block jf-max-w-full jf-rounded-lg jf-border jf-border-gray-200 jf-bg-white jf-p-2 jf-shadow-sm"
          style={{ maxWidth: '100%' }}
        >
          <img
            src={imgData}
            alt={alt}
            className={`jf-cursor-zoom-in jf-transition-opacity jf-rounded-md jf-max-w-full ${className || ''}`}
            width={width}
            height={height}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '320px',
              objectFit: 'contain',
              margin: '0 auto',
            }}
            onClick={() => setIsLightboxOpen(true)}
          />
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="jf-absolute jf-right-2 jf-top-2 jf-rounded jf-bg-blue-600 jf-px-2 jf-py-1 jf-text-xs jf-font-medium jf-text-white hover:jf-bg-blue-700"
          >
            放大查看
          </button>
        </div>
      </div>
      
      {/* Lightbox / Fullscreen Image */}
      {isLightboxOpen && (
        <div 
          className="jf-fixed jf-inset-0 jf-z-[9999] jf-bg-black/80 jf-backdrop-blur-sm jf-flex jf-items-center jf-justify-center jf-p-8"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="jf-absolute jf-right-4 jf-top-4 jf-rounded jf-bg-white jf-px-3 jf-py-2 jf-text-sm jf-font-medium jf-text-gray-700 hover:jf-bg-gray-100"
          >
            关闭
          </button>
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
