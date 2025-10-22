import React, { useState, useCallback, useRef, useEffect } from 'react';
import { WandIcon, FileUploadIcon, TrashIcon, DocumentIcon } from './Icons';

interface ProblemSolverFormProps {
  onGenerateSolution: (problem: string, language: string, file: File | null, level: string) => void;
  isLoading: boolean;
}

const LANGUAGES = ['JavaScript', 'Python', 'Java', 'C++', 'TypeScript', 'Go', 'Rust', 'SQL'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const PROBLEM_DESC_MAX_LENGTH = 5000;

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const ProblemSolverForm: React.FC<ProblemSolverFormProps> = ({ onGenerateSolution, isLoading }) => {
  const [problem, setProblem] = useState('');
  const [language, setLanguage] = useState('JavaScript');
  const [level, setLevel] = useState('Intermediate');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [levelGliderStyle, setLevelGliderStyle] = useState({});
  const levelTabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const activeTabIndex = LEVELS.findIndex(l => l === level);
    const activeTab = levelTabsRef.current[activeTabIndex];
    if (activeTab) {
      setLevelGliderStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      });
    }
  }, [level]);

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile) {
      setFile(selectedFile);
    }
  };
  
  const onDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if(isLoading) return; setIsDragging(true); }, [isLoading]);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if(isLoading) return; setIsDragging(false); }, [isLoading]);
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); if(isLoading) return; setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, [isLoading]);
  
  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation(); setFile(null);
    if(fileInputRef.current) { fileInputRef.current.value = ""; }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem.trim() && !file) return;
    onGenerateSolution(problem, language, file, level);
  };
  
  const handleProblemChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= PROBLEM_DESC_MAX_LENGTH) {
      setProblem(e.target.value);
    }
  };

  const commonInputClasses = "w-full px-4 py-2 bg-base-100/50 dark:bg-dark-base-100/50 border border-base-300 dark:border-dark-base-300/50 rounded-lg shadow-sm focus:bg-base-100 dark:focus:bg-dark-base-100 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none transition duration-200 ease-in-out disabled:opacity-50";

  return (
    <div className="bg-base-100/50 dark:bg-dark-base-100/50 backdrop-blur-sm p-4 sm:p-6 rounded-lg shadow-lg border border-base-300 dark:border-dark-base-300/50">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="problemDescription" className="block text-sm font-medium text-base-content dark:text-dark-content">
              Technical Problem
            </label>
            <span className={`text-xs ${problem.length > PROBLEM_DESC_MAX_LENGTH - 200 ? 'text-amber-600' : 'text-base-content/50 dark:text-dark-content/50'}`}>
                {problem.length} / {PROBLEM_DESC_MAX_LENGTH}
            </span>
          </div>
          <textarea
            id="problemDescription"
            rows={5}
            value={problem}
            onChange={handleProblemChange}
            placeholder="Describe your problem, or upload a file below..."
            disabled={isLoading}
            className={commonInputClasses}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-base-content dark:text-dark-content mb-1">
              Attach File (Optional)
          </label>
          <div 
              className={`relative group transition-all duration-300 ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}
              onClick={() => !isLoading && !file && fileInputRef.current?.click()}
          >
              <div 
                  className={`w-full flex flex-col items-center justify-center p-4 bg-base-100/50 dark:bg-dark-base-100/50 border-2 rounded-lg shadow-sm transition-all duration-300
                      ${isDragging ? 'border-primary ring-2 ring-primary/50 bg-primary/10' : 'border-base-300 dark:border-dark-base-300/50 border-dashed'}
                      ${!isLoading && !file && 'cursor-pointer group-hover:border-primary'}`}
              >
                  {!file ? (
                      <div className="text-center">
                          <FileUploadIcon className="mx-auto h-8 w-8 text-base-content/40 transition-colors duration-300 group-hover:text-primary" />
                          <p className="mt-2 text-sm text-base-content/70 dark:text-dark-content/70">
                              <span className="font-semibold text-primary">Click to upload</span> or drag and drop.
                          </p>
                          <p className="text-xs text-base-content/50 dark:text-dark-content/50 mt-1">Code files, images, or documents</p>
                      </div>
                  ) : (
                      <div className="w-full flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                              <DocumentIcon className="w-8 h-8 text-primary flex-shrink-0" />
                              <div className="min-w-0">
                                  <p className="text-sm font-medium text-base-content dark:text-dark-content truncate" title={file.name}>
                                      {file.name}
                                  </p>
                                  <p className="text-xs text-base-content/60 dark:text-dark-content/60">
                                      {formatBytes(file.size)}
                                  </p>
                              </div>
                          </div>
                          {!isLoading && (
                              <button
                                  type="button"
                                  onClick={handleRemoveFile}
                                  className="ml-4 p-1.5 text-base-content/60 hover:bg-red-100 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded-full flex-shrink-0 transition-colors"
                                  aria-label="Remove file"
                              >
                                  <TrashIcon className="w-5 h-5"/>
                              </button>
                          )}
                      </div>
                  )}
              </div>
              <input 
                  ref={fileInputRef} id="file-upload" name="file-upload" type="file" className="sr-only" 
                  onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
                  disabled={isLoading}
              />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-base-content dark:text-dark-content mb-1">
              Language
            </label>
            <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={isLoading} className={commonInputClasses}>
              {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-base-content dark:text-dark-content mb-1">
                Difficulty Level
            </label>
            <div className="relative grid grid-cols-3 gap-1 rounded-lg bg-base-200 dark:bg-dark-base-200/50 p-1">
                <div 
                    className="absolute h-[calc(100%-0.5rem)] bg-base-100 dark:bg-dark-base-300 shadow rounded-md transition-all duration-300 ease-in-out"
                    style={levelGliderStyle}
                />
                {LEVELS.map((l, index) => (
                    <button
                        ref={el => { levelTabsRef.current[index] = el; }}
                        key={l}
                        type="button"
                        onClick={() => !isLoading && setLevel(l)}
                        disabled={isLoading}
                        className={`relative z-10 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-base-100 ${
                            level === l
                                ? 'text-primary'
                                : 'text-base-content/70 dark:text-dark-content/70 hover:text-base-content dark:hover:text-dark-content'
                        }`}
                    >
                        {l}
                    </button>
                ))}
            </div>
          </div>
        </div>

        <div className="flex justify-center sm:justify-end pt-4">
          <button
            type="submit"
            disabled={isLoading || (!problem.trim() && !file)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 border border-transparent text-base font-semibold rounded-lg shadow-sm text-primary-content bg-primary bg-gradient-to-br from-primary to-blue-500 hover:from-primary-focus hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark-base-100 disabled:bg-base-300 dark:disabled:bg-dark-base-300 disabled:text-base-content/50 dark:disabled:text-dark-content/50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out transform hover:scale-105"
          >
            <WandIcon className="w-5 h-5" />
            {isLoading ? 'Solving...' : 'Generate Solution'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProblemSolverForm;