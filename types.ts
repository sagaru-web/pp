

export enum QuestionCategory {
  HR = 'HR',
  Technical = 'Technical',
  Behavioral = 'Behavioral',
}

export interface InterviewQuestion {
  question: string;
  category: QuestionCategory;
  suggestedAnswer: string;
}

export interface TechnicalSolution {
  explanation: string;
  code: string;
}

export interface InterviewPrepResult {
  questions: InterviewQuestion[];
  approachGuide: string | null;
  companyName: string | null;
}

export interface SavedSession {
  id: number;
  jobRole: string;
  createdAt: string;
  questions: InterviewQuestion[];
  approachGuide?: string | null;
  companyName?: string | null;
  experienceLevel?: string;
}

export enum AppView {
  InterviewPrep = 'InterviewPrep',
  ProblemSolver = 'ProblemSolver',
  SavedSessions = 'SavedSessions',
}

export interface StructuredFeedback {
  clarity: number; // Rating out of 5
  structure: number; // Rating out of 5
  relevance: number; // Rating out of 5
  overallImpression: string; // A short summary paragraph
  improvementPoints: string[]; // Actionable bullet points
  followUpQuestion?: string; // An optional suggested follow-up question
}

export interface AnswerFeedback {
  userAnswer: string;
  feedback: StructuredFeedback | string; // Use string for error messages
  userAudioUrl: string | null;
}

export interface ValidationResult {
  status: 'valid' | 'improvable' | 'invalid';
  reason: string;
}


// --- Types for Mock Interview Modal useReducer ---

export type InterviewStep = 'question' | 'feedback' | 'summary' | 'permission_denied' | 'error';

export interface MockInterviewState {
    step: InterviewStep;
    currentIndex: number;
    isRecording: boolean;
    isProcessing: boolean;
    answers: Map<number, AnswerFeedback>;
    audioStream: MediaStream | null;
    countdown: number | null;
    recordingTime: number;
    error: string | null;
    isQuestionAudioPlaying: boolean;
}

export type MockInterviewAction =
    | { type: 'START_INTERVIEW' }
    | { type: 'CLOSE_INTERVIEW' }
    | { type: 'REQUEST_PERMISSION_SUCCESS'; stream: MediaStream }
    | { type: 'REQUEST_PERMISSION_FAILURE' }
    | { type: 'START_COUNTDOWN' }
    | { type: 'DECREMENT_COUNTDOWN' }
    | { type: 'START_RECORDING' }
    | { type: 'STOP_RECORDING' }
    | { type: 'START_PROCESSING' }
    | { type: 'FINISH_PROCESSING'; answer: AnswerFeedback }
    | { type: 'PROCESSING_ERROR'; error: string }
    | { type: 'NEXT_QUESTION'; questions: InterviewQuestion[] }
    | { type: 'RETRY_QUESTION' }
    | { type: 'TICK_TIMER' }
    | { type: 'PLAY_QUESTION_AUDIO' }
    | { type: 'FINISH_QUESTION_AUDIO' };