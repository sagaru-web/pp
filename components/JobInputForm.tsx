import React, { useState, useRef, useEffect, useMemo } from 'react';
import { WandIcon } from './Icons';

interface JobInputFormProps {
  jobRole: string;
  setJobRole: (role: string) => void;
  companyName: string;
  setCompanyName: (name: string) => void;
  jobDescription: string;
  setJobDescription: (desc: string) => void;
  experienceLevel: string;
  setExperienceLevel: (level: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  loadingMessage?: string;
}

const EXPERIENCE_LEVELS = ['Fresher', '1-3 Years', '3-5 Years', '5+ Years'];
const JOB_DESC_MAX_WORDS = 2000;

const getWordCount = (text: string) => {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
};

const JobInputForm: React.FC<JobInputFormProps> = ({ 
    jobRole, setJobRole, 
    companyName, setCompanyName,
    jobDescription, setJobDescription, 
    experienceLevel, setExperienceLevel, 
    onSubmit, isLoading, loadingMessage 
}) => {
  const commonInputClasses = "w-full px-4 py-2 bg-base-100/50 dark:bg-dark-base-100/50 border border-base-300 dark:border-dark-base-300/50 rounded-lg shadow-sm focus:bg-base-100 dark:focus:bg-dark-base-100 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none transition duration-200 ease-in-out disabled:opacity-50";
  
  const [gliderStyle, setGliderStyle] = useState({});
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  
  const wordCount = useMemo(() => getWordCount(jobDescription), [jobDescription]);

  useEffect(() => {
    const activeTabIndex = EXPERIENCE_LEVELS.findIndex(l => l === experienceLevel);
    const activeTab = tabsRef.current[activeTabIndex];
    if (activeTab) {
      setGliderStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      });
    }
  }, [experienceLevel]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (getWordCount(e.target.value) <= JOB_DESC_MAX_WORDS) {
      setJobDescription(e.target.value);
    } else {
      // Allow typing but show the limit has been passed.
      // Or, slice the text to the word limit - but that's complex. 
      // This simple check is usually enough to guide the user.
      const words = e.target.value.trim().split(/\s+/);
      setJobDescription(words.slice(0, JOB_DESC_MAX_WORDS).join(' '));
    }
  };


  return (
    <div className="bg-base-100/50 dark:bg-dark-base-100/50 backdrop-blur-sm p-4 sm:p-6 rounded-lg shadow-lg border border-base-300 dark:border-dark-base-300/50">
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="jobRole" className="block text-sm font-medium text-base-content dark:text-dark-content mb-1">
              Job Role
            </label>
            <input
              id="jobRole"
              type="text"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="e.g., Senior Frontend Developer"
              disabled={isLoading}
              className={commonInputClasses}
            />
          </div>
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-base-content dark:text-dark-content mb-1">
              Company Name (Optional)
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Google"
              disabled={isLoading}
              className={commonInputClasses}
            />
          </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-base-content dark:text-dark-content mb-1">
                Experience Level
            </label>
            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg bg-base-200 dark:bg-dark-base-200/50 p-1">
                <div 
                    className="absolute h-[calc(100%-0.5rem)] bg-base-100 dark:bg-dark-base-300 shadow rounded-md transition-all duration-300 ease-in-out"
                    style={gliderStyle}
                />
                {EXPERIENCE_LEVELS.map((level, index) => (
                    <button
                        ref={el => { tabsRef.current[index] = el; }}
                        key={level}
                        type="button"
                        onClick={() => !isLoading && setExperienceLevel(level)}
                        disabled={isLoading}
                        className={`relative z-10 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-base-100 ${
                            experienceLevel === level
                                ? 'text-primary'
                                : 'text-base-content/70 dark:text-dark-content/70 hover:text-base-content dark:hover:text-dark-content'
                        }`}
                    >
                        {level}
                    </button>
                ))}
            </div>
        </div>
        <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="jobDescription" className="block text-sm font-medium text-base-content dark:text-dark-content">
                Job Description
              </label>
              <span className={`text-xs ${wordCount > JOB_DESC_MAX_WORDS - 100 ? 'text-amber-600' : 'text-base-content/50 dark:text-dark-content/50'}`}>
                {wordCount} / {JOB_DESC_MAX_WORDS} words
              </span>
            </div>
            <textarea
                id="jobDescription"
                rows={10}
                value={jobDescription}
                onChange={handleDescriptionChange}
                placeholder="Paste the full job description here..."
                disabled={isLoading}
                className={commonInputClasses}
            />
             <p className="text-xs text-base-content/60 dark:text-dark-content/60 mt-1">
                A detailed job description yields the most relevant questions.
            </p>
        </div>
        <div className="flex justify-center sm:justify-end pt-4">
          <button
            type="submit"
            disabled={isLoading || !jobRole.trim() || !jobDescription.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 border border-transparent text-base font-semibold rounded-lg shadow-sm text-primary-content bg-primary bg-gradient-to-br from-primary to-blue-500 hover:from-primary-focus hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark-base-100 disabled:bg-base-300 dark:disabled:bg-dark-base-300 disabled:text-base-content/50 dark:disabled:text-dark-content/50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out transform hover:scale-105"
          >
            <WandIcon className="w-5 h-5"/>
            {isLoading ? (loadingMessage || 'Generating...') : 'Generate Questions'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default JobInputForm;