import React, { useState, useEffect, useRef } from 'react';
import { ClipboardIcon, ClipboardCheckIcon } from './Icons';

// Define hljs on the window object for TypeScript
declare global {
  interface Window {
    hljs: any;
  }
}

const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Trigger highlight.js when the component mounts or the code changes
    if (codeRef.current && window.hljs) {
      window.hljs.highlightElement(codeRef.current);
    }
  }, [code, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Format language for the className, defaulting to 'plaintext' if empty
  const languageClass = `language-${language ? language.toLowerCase() : 'plaintext'}`;

  return (
    <div className="font-mono">
      <div className="flex justify-between items-center px-4 py-2 bg-slate-800/50">
        <span className="text-xs font-semibold text-slate-400 uppercase">{language || 'Code'}</span>
        <div className="tooltip">
            <button
              onClick={handleCopy}
              className="text-slate-400 hover:text-white focus:outline-none flex items-center gap-2"
              aria-label="Copy code to clipboard"
            >
              {copied ? 
                <>
                    <ClipboardCheckIcon className="w-4 h-4 text-emerald-400"/> 
                    <span className="text-xs text-emerald-400">Copied!</span>
                </>
                : 
                <ClipboardIcon className="w-4 h-4"/>
              }
            </button>
            {!copied && <span className="tooltip-text">Copy code</span>}
        </div>
      </div>
      <pre className="text-sm text-slate-50 overflow-auto max-h-[40rem] bg-slate-900/50">
        <code ref={codeRef} className={languageClass}>
          {code}
        </code>
      </pre>
    </div>
  );
};

export default CodeBlock;