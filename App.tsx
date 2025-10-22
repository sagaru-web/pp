import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import { InterviewQuestion, TechnicalSolution, AppView, SavedSession, InterviewPrepResult } from './types';
import { generateInterviewQuestions, generateTechnicalSolution, validateJobInput } from './services/geminiService';
import Header from './components/Header';
import Footer from './components/Footer';
import JobInputForm from './components/JobInputForm';
import QuestionCard from './components/QuestionCard';
import LoadingSpinner from './components/LoadingSpinner';
import ProblemSolverForm from './components/ProblemSolverForm';
import CodeBlock from './components/CodeBlock';
import ConfirmationModal from './components/ConfirmationModal';
import AlertModal from './components/AlertModal';
import MockInterviewModal from './components/MockInterviewModal';
import { BriefcaseIcon, LightbulbIcon, BookmarkIcon, TrashIcon, DownloadIcon, ChevronDownIcon, EyeIcon, MicrophoneIcon, BuildingIcon, ArrowUpDownIcon } from './components/Icons';

type Theme = 'light' | 'dark';

const App: React.FC = () => {
    // Core App State
    const [theme, setTheme] = useState<Theme>('dark');
    const [activeView, setActiveView] = useState<AppView>(AppView.InterviewPrep);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');

    // Interview Prep State
    const [jobRole, setJobRole] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [experienceLevel, setExperienceLevel] = useState('1-3 Years');
    const [interviewPrepData, setInterviewPrepData] = useState<InterviewPrepResult | null>(null);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);

    // Problem Solver State
    const [technicalSolution, setTechnicalSolution] = useState<TechnicalSolution | null>(null);
    const [solutionLanguage, setSolutionLanguage] = useState('');
    const [isExplanationOpen, setIsExplanationOpen] = useState(false);
    const solutionRef = useRef<HTMLDivElement>(null);


    // Saved Sessions State
    const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
    const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    
    // Modal State
    const [alertInfo, setAlertInfo] = useState<{title: string, message: string} | null>(null);
    const [validationWarning, setValidationWarning] = useState<{ message: string } | null>(null);

    // Gliding Tab State
    const [gliderStyle, setGliderStyle] = useState({});
    const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

    const tabItems = useMemo(() => [
        { id: AppView.InterviewPrep, label: 'Interview Prep', icon: BriefcaseIcon },
        { id: AppView.ProblemSolver, label: 'Problem Solver', icon: LightbulbIcon },
        { id: AppView.SavedSessions, label: 'Saved Sessions', icon: BookmarkIcon },
    ], []);

    const sortedSessions = useMemo(() => {
        const sessionsToSort = [...savedSessions];
        sessionsToSort.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            // FIX: Corrected a typo in the sort logic. `b` was used instead of `dateB`.
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });
        return sessionsToSort;
    }, [savedSessions, sortOrder]);


    // Theme effect
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as Theme | null;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        setTheme(initialTheme);
    }, []);
    
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Load saved sessions from local storage on mount
    useEffect(() => {
        try {
            const storedSessions = localStorage.getItem('interviewSessions');
            if (storedSessions) {
                setSavedSessions(JSON.parse(storedSessions));
            }
        } catch (e) {
            console.error("Failed to parse saved sessions from localStorage", e);
            // If parsing fails, clear the corrupted data to prevent future errors
            localStorage.removeItem('interviewSessions');
            setSavedSessions([]);
        }
    }, []);

    // Auto-scroll to solution
    useEffect(() => {
        if (technicalSolution) {
            const timer = setTimeout(() => {
                solutionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [technicalSolution]);
    
    // Gliding tab effect
    useEffect(() => {
        const activeTabIndex = tabItems.findIndex(tab => tab.id === activeView);
        const activeTab = tabsRef.current[activeTabIndex];
        if (activeTab) {
            setGliderStyle({
                left: activeTab.offsetLeft,
                width: activeTab.offsetWidth,
            });
        }
    }, [activeView, tabItems]);

    const proceedWithGeneration = async (role: string, description: string, level: string, company: string) => {
        setIsLoading(true);
        setError(null);
        setInterviewPrepData(null);
        setLoadingMessage('Crafting your prep plan...');

        try {
            const results = await generateInterviewQuestions(role, description, level, company);
            setInterviewPrepData(results);
            // Sync company name state with the result, in case AI extracted one
            if (results.companyName) {
                setCompanyName(results.companyName);
            }
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
            setAlertInfo({ title: "Generation Failed", message: err.message });
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleGenerateQuestions = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedRole = jobRole.trim();
        const trimmedDescription = jobDescription.trim();
        const trimmedCompany = companyName.trim();

        if (!trimmedRole || !trimmedDescription) {
            setAlertInfo({ title: "Input Required", message: "Please provide both a Job Role and a Job Description." });
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setInterviewPrepData(null);
        setLoadingMessage('Validating input...');
        
        const validation = await validateJobInput(trimmedRole, trimmedDescription);
        
        if (validation.status === 'invalid') {
            setAlertInfo({ title: "Invalid Input", message: validation.reason });
            setIsLoading(false);
            return;
        }

        if (validation.status === 'improvable') {
            setValidationWarning({ message: validation.reason });
            setIsLoading(false);
            return;
        }

        await proceedWithGeneration(trimmedRole, trimmedDescription, experienceLevel, trimmedCompany);
    };
    
    const handleGenerateSolution = async (problem: string, language: string, file: File | null, level: string) => {
        setIsLoading(true);
        setLoadingMessage('Solving your problem...');
        setError(null);
        setTechnicalSolution(null);
        
        try {
            const solution = await generateTechnicalSolution(problem, language, level, file);
            setTechnicalSolution(solution);
            setSolutionLanguage(language);
            setIsExplanationOpen(true); // Start with explanation open
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
            setAlertInfo({ title: "Solution Failed", message: err.message });
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleSaveSession = useCallback(() => {
        if (!interviewPrepData) return;
        const newSession: SavedSession = {
            id: Date.now(),
            jobRole,
            experienceLevel,
            companyName: companyName, // Use the state which user can control
            createdAt: new Date().toISOString(),
            questions: interviewPrepData.questions,
            approachGuide: interviewPrepData.approachGuide,
        };
        const updatedSessions = [newSession, ...savedSessions];
        setSavedSessions(updatedSessions);
        localStorage.setItem('interviewSessions', JSON.stringify(updatedSessions));
        setActiveView(AppView.SavedSessions);
    }, [jobRole, companyName, interviewPrepData, savedSessions, experienceLevel]);

    const handleViewSession = (session: SavedSession) => {
        setJobRole(session.jobRole);
        setCompanyName(session.companyName || '');
        setJobDescription(''); // Clear description as it's not saved
        setExperienceLevel(session.experienceLevel || '1-3 Years');
        setInterviewPrepData({
            questions: session.questions,
            approachGuide: session.approachGuide || null,
            companyName: session.companyName || null,
        });
        setActiveView(AppView.InterviewPrep);
    };

    const handleDeleteSession = (id: number) => {
        setSessionToDelete(id);
    };

    const confirmDeleteSession = () => {
        if (sessionToDelete !== null) {
            const updatedSessions = savedSessions.filter(s => s.id !== sessionToDelete);
            setSavedSessions(updatedSessions);
            localStorage.setItem('interviewSessions', JSON.stringify(updatedSessions));
            setSessionToDelete(null);
        }
    };

    const handleDownloadPdf = async () => {
        if (!interviewPrepData) return;
        setIsDownloadingPdf(true);
        try {
            const doc = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });

            const margin = 15;
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            const usableWidth = pageWidth - 2 * margin;
            let y = margin;
            
            const addPageIfNeeded = (spaceNeeded: number) => {
                if (y + spaceNeeded > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }
            };
            
            const writeText = (text: string | string[], x: number, startY: number, options: any = {}) => {
                const lines = Array.isArray(text) ? text : doc.splitTextToSize(text, usableWidth);
                const textHeight = lines.length * (doc.getLineHeight() / doc.internal.scaleFactor);
                addPageIfNeeded(textHeight);
                doc.text(lines, x, y, options);
                y += textHeight;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            writeText(`Interview Prep: ${jobRole}`, pageWidth / 2, y, { align: 'center' });
            y += 2;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            writeText(`Experience Level: ${experienceLevel}`, pageWidth / 2, y, { align: 'center' });
            y += 10;

            if(interviewPrepData.approachGuide){
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                const guideTitle = interviewPrepData.companyName 
                    ? `Insider's Guide to Interviewing at ${interviewPrepData.companyName}` 
                    : 'General Interview Approach';
                writeText(guideTitle, margin, y);
                y += 4;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                writeText(interviewPrepData.approachGuide, margin, y);
                y += 10;
            }
            
            interviewPrepData.questions.forEach((item, index) => {
                addPageIfNeeded(25);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                writeText(`${index + 1}. ${item.question}`, margin, y);
                y += 5;

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                writeText('Suggested Answer:', margin, y);
                y += 2;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                
                const cleanedAnswer = item.suggestedAnswer.replace(/\*\*/g, '');
                writeText(cleanedAnswer, margin, y);

                y += 10;
            });

            doc.save(`${jobRole.replace(/\s/g, '_')}_Interview_Prep.pdf`);
        } catch (pdfError) {
            console.error("Failed to generate PDF:", pdfError);
            setAlertInfo({
                title: "PDF Download Failed",
                message: "Sorry, there was an unexpected error while creating the PDF file. Please try again."
            });
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const renderView = () => {
        const viewContent = () => {
            switch (activeView) {
                case AppView.InterviewPrep:
                    return (
                        <>
                            <JobInputForm 
                                jobRole={jobRole}
                                setJobRole={setJobRole}
                                companyName={companyName}
                                setCompanyName={setCompanyName}
                                jobDescription={jobDescription}
                                setJobDescription={setJobDescription}
                                experienceLevel={experienceLevel}
                                setExperienceLevel={setExperienceLevel}
                                onSubmit={handleGenerateQuestions}
                                isLoading={isLoading}
                                loadingMessage={loadingMessage}
                            />
                             {isLoading && <LoadingSpinner message={loadingMessage} />}
                             {error && !isLoading && <p className="text-red-500 text-center p-4">{error}</p>}
                             {interviewPrepData && interviewPrepData.questions.length > 0 && (
                                <div className="space-y-4">
                                     {interviewPrepData.approachGuide && (
                                        <div className="bg-blue-500/10 dark:bg-blue-500/10 border border-blue-500/30 p-4 sm:p-5 rounded-lg shadow-sm animate-fade-in">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0 bg-blue-500/20 p-2 rounded-full">
                                                    <LightbulbIcon className="w-6 h-6 text-blue-500 dark:text-blue-300"/>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200">
                                                        {interviewPrepData.companyName 
                                                            ? `Insider's Guide to Interviewing at ${interviewPrepData.companyName}` 
                                                            : 'General Interview Approach'}
                                                    </h3>
                                                </div>
                                            </div>
                                            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-blue-900/90 dark:text-blue-200/90 whitespace-pre-line leading-relaxed mt-4">
                                               {interviewPrepData.approachGuide}
                                            </div>
                                        </div>
                                     )}
                                     <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-4 pb-4 mb-4 border-b border-base-300 dark:border-dark-base-300/50">
                                        <h2 className="text-xl sm:text-2xl font-bold text-base-content dark:text-dark-content text-center sm:text-left">Your Questions for {jobRole}</h2>
                                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                            <button onClick={() => setIsInterviewModalOpen(true)} className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20">
                                                <MicrophoneIcon className="w-4 h-4" /> Start Mock Interview
                                            </button>
                                            <button onClick={handleSaveSession} className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-base-300 dark:border-dark-base-300/50 bg-base-100/50 dark:bg-dark-base-100/50 hover:bg-base-200 dark:hover:bg-dark-base-300">
                                                <BookmarkIcon className="w-4 h-4" /> Save
                                            </button>
                                            <button onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-base-300 dark:border-dark-base-300/50 bg-base-100/50 dark:bg-dark-base-100/50 hover:bg-base-200 dark:hover:bg-dark-base-300 disabled:opacity-50">
                                               <DownloadIcon className="w-4 h-4" /> {isDownloadingPdf ? 'Downloading...' : 'PDF'}
                                            </button>
                                        </div>
                                    </div>
                                    {interviewPrepData.questions.map((q, i) => (
                                        <QuestionCard key={i} item={q} index={i} />
                                    ))}
                                </div>
                             )}
                        </>
                    );
                case AppView.ProblemSolver:
                    return (
                        <>
                            <ProblemSolverForm onGenerateSolution={handleGenerateSolution} isLoading={isLoading} />
                            {isLoading && <LoadingSpinner message={loadingMessage || "Solving your problem..."} />}
                            {error && !isLoading && <p className="text-red-500 text-center p-4">{error}</p>}
                            {technicalSolution && (
                                <div ref={solutionRef} className="space-y-6">
                                    <div className="bg-base-100/50 dark:bg-dark-base-100/50 backdrop-blur-sm p-4 sm:p-6 rounded-lg shadow-lg border border-base-300 dark:border-dark-base-300/50">
                                        <button
                                            onClick={() => setIsExplanationOpen(!isExplanationOpen)}
                                            className="w-full flex justify-between items-center text-left"
                                            aria-expanded={isExplanationOpen}
                                        >
                                            <h3 className="text-xl font-bold text-base-content dark:text-dark-content">Explanation</h3>
                                            <ChevronDownIcon className={`w-6 h-6 transform transition-transform duration-300 ${isExplanationOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                         <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isExplanationOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                            <div className="overflow-hidden">
                                                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-base-content/90 dark:text-dark-content/80 whitespace-pre-line leading-relaxed pt-4 mt-4 border-t border-base-300 dark:border-dark-base-300/50">
                                                    {technicalSolution.explanation.replace(/\*\*/g, '')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg shadow-lg border border-dark-base-300/50 overflow-hidden">
                                        <div className="px-4 sm:px-6 py-4 border-b border-dark-base-300/50">
                                          <h3 className="text-xl font-bold text-dark-content">Code Solution</h3>
                                        </div>
                                        <CodeBlock code={technicalSolution.code} language={solutionLanguage} />
                                    </div>
                                </div>
                            )}
                        </>
                    );
                case AppView.SavedSessions:
                    return (
                        <div className="bg-base-100/50 dark:bg-dark-base-100/50 backdrop-blur-sm p-4 sm:p-6 rounded-lg shadow-lg border border-base-300 dark:border-dark-base-300/50">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <h2 className="text-xl sm:text-2xl font-bold text-base-content dark:text-dark-content">Saved Sessions</h2>
                                {savedSessions.length > 1 && (
                                    <button
                                        onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-base-300 dark:border-dark-base-300/50 bg-base-100/50 dark:bg-dark-base-100/50 hover:bg-base-200 dark:hover:bg-dark-base-300"
                                    >
                                        <ArrowUpDownIcon className="w-4 h-4" />
                                        Sort by: {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                                    </button>
                                )}
                            </div>
                            {sortedSessions.length > 0 ? (
                                <ul className="space-y-4">
                                    {sortedSessions.map((session, index) => (
                                        <li 
                                            key={session.id} 
                                            className="p-4 bg-base-100 dark:bg-dark-base-100/70 border border-base-300 dark:border-dark-base-300/50 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md hover:border-primary/50 dark:hover:border-dark-primary/50 transition-all duration-200 animate-stagger-in"
                                            style={{ animationDelay: `${index * 70}ms` }}
                                        >
                                            <div>
                                                <p className="font-semibold text-base-content dark:text-dark-content">{session.jobRole}</p>
                                                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-base-content/70 dark:text-dark-content/70 mt-1">
                                                    <span>
                                                        Saved on {new Date(session.createdAt).toLocaleDateString()}
                                                    </span>
                                                    <span className="w-1 h-1 bg-base-content/20 dark:bg-dark-content/20 rounded-full"></span>
                                                    <span>
                                                        {session.experienceLevel || 'N/A'}
                                                    </span>
                                                    <span className="w-1 h-1 bg-base-content/20 dark:bg-dark-content/20 rounded-full"></span>
                                                    <span>
                                                        {session.questions.length} Questions
                                                    </span>
                                                    {session.companyName && (
                                                        <>
                                                            <span className="w-1 h-1 bg-base-content/20 dark:bg-dark-content/20 rounded-full"></span>
                                                            <span className="flex items-center gap-1.5 font-medium">
                                                                <BuildingIcon className="w-4 h-4 text-base-content/50 dark:text-dark-content/50" />
                                                                {session.companyName}
                                                            </span>
                                                        </>
                                                    )}
                                                    {session.approachGuide && (
                                                         <>
                                                            <span className="w-1 h-1 bg-base-content/20 dark:bg-dark-content/20 rounded-full"></span>
                                                            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                                                                <LightbulbIcon className="w-4 h-4" /> Guide Included
                                                            </span>
                                                         </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                                                <button 
                                                    onClick={() => handleViewSession(session)} 
                                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                                                >
                                                    <EyeIcon className="w-4 h-4" /> View
                                                </button>
                                                <div className="tooltip">
                                                    <button 
                                                        onClick={() => handleDeleteSession(session.id)} 
                                                        className="p-2 text-base-content/60 dark:text-dark-content/60 hover:bg-red-100 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded-full"
                                                        aria-label={`Delete session for ${session.jobRole}`}
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                    <span className="tooltip-text">Delete</span>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                 <div className="text-center py-10 border-2 border-dashed border-base-300 dark:border-dark-base-300/50 rounded-lg">
                                    <BookmarkIcon className="mx-auto h-12 w-12 text-base-content/30 dark:text-dark-content/30" />
                                    <h3 className="mt-2 text-lg font-medium text-base-content dark:text-dark-content">No saved sessions</h3>
                                    <p className="mt-1 text-sm text-base-content/70 dark:text-dark-content/70">Your saved interview preps will appear here.</p>
                                </div>
                            )}
                        </div>
                    );
            }
        }
        return <div className="space-y-8 animate-fade-in">{viewContent()}</div>
    };

    return (
        <div className="min-h-screen flex flex-col bg-base-200 dark:bg-dark-base-200 text-base-content dark:text-dark-content font-sans">
            <Header theme={theme} setTheme={setTheme} />
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-8 flex justify-center">
                       <div className="relative p-1.5 bg-base-100/50 dark:bg-dark-base-100/50 backdrop-blur-sm rounded-xl shadow-md border border-base-300 dark:border-dark-base-300/50 flex items-center gap-2">
                            <div 
                                className="absolute h-10 bg-primary rounded-lg transition-all duration-300 ease-in-out"
                                style={gliderStyle}
                            />
                            {tabItems.map((tab, index) => (
                                <button
                                    key={tab.id}
                                    ref={el => { tabsRef.current[index] = el; }}
                                    onClick={() => setActiveView(tab.id)}
                                    className={`relative z-10 whitespace-nowrap flex items-center justify-center gap-2 h-10 px-4 sm:px-6 rounded-lg font-semibold text-sm transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 dark:focus-visible:ring-offset-dark-base-100 ${
                                        activeView === tab.id
                                        ? 'text-primary-content'
                                        : 'text-base-content/70 dark:text-dark-content/70 hover:text-base-content dark:hover:text-dark-content'
                                    }`}
                                >
                                    <tab.icon className="w-5 h-5"/>
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {renderView()}
                </div>
            </main>
            <Footer />
            {isInterviewModalOpen && (
                <MockInterviewModal
                    isOpen={isInterviewModalOpen}
                    onClose={() => setIsInterviewModalOpen(false)}
                    questions={interviewPrepData?.questions || []}
                    jobRole={jobRole}
                />
            )}
            <ConfirmationModal
                isOpen={sessionToDelete !== null}
                onClose={() => setSessionToDelete(null)}
                onConfirm={confirmDeleteSession}
                title="Delete Session"
                message="Are you sure you want to delete this session? This action cannot be undone."
                variant="danger"
                confirmText="Delete"
            />
            <ConfirmationModal
                isOpen={validationWarning !== null}
                onClose={() => setValidationWarning(null)}
                onConfirm={() => {
                    setValidationWarning(null);
                    proceedWithGeneration(jobRole.trim(), jobDescription.trim(), experienceLevel, companyName.trim());
                }}
                title="Suggestion for Better Results"
                message={validationWarning?.message || ''}
                variant="primary"
                confirmText="Continue Anyway"
                cancelText="Go Back & Edit"
            />
            <AlertModal
                isOpen={alertInfo !== null}
                onClose={() => { setAlertInfo(null); setError(null); }}
                title={alertInfo?.title || ''}
                message={alertInfo?.message || ''}
            />
        </div>
    );
};

export default App;