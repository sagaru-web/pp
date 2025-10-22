import React, { useEffect, useRef, useReducer, useState } from 'react';
import { InterviewQuestion, AnswerFeedback, MockInterviewState, MockInterviewAction } from '../types';
import { generateAnswerFeedback, transcribeAudio, textToSpeech } from '../services/geminiService';
import { XCircleIcon, MicrophoneIcon, StopCircleIcon, InfoIcon, WarningIcon, RefreshCwIcon, StarIcon, PlayCircleIcon, PauseCircleIcon, Volume2Icon } from './Icons';
import LoadingSpinner from './LoadingSpinner';
import AudioVisualizer from './AudioVisualizer';

interface MockInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: InterviewQuestion[];
  jobRole: string;
}

// Helper functions for audio processing
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


const initialState: MockInterviewState = {
    step: 'question',
    currentIndex: 0,
    isRecording: false,
    isProcessing: false,
    answers: new Map(),
    audioStream: null,
    countdown: null,
    recordingTime: 0,
    error: null,
    isQuestionAudioPlaying: false,
};

function mockInterviewReducer(state: MockInterviewState, action: MockInterviewAction): MockInterviewState {
    switch (action.type) {
        case 'START_INTERVIEW':
            return { ...initialState };
        case 'CLOSE_INTERVIEW':
            state.audioStream?.getTracks().forEach(track => track.stop());
            return { ...initialState, audioStream: null };
        case 'REQUEST_PERMISSION_SUCCESS':
            return { ...state, audioStream: action.stream };
        case 'REQUEST_PERMISSION_FAILURE':
            return { ...state, step: 'permission_denied' };
        case 'START_COUNTDOWN':
            return { ...state, countdown: 3 };
        case 'DECREMENT_COUNTDOWN':
            return { ...state, countdown: state.countdown !== null ? state.countdown - 1 : null };
        case 'START_RECORDING':
            return { ...state, isRecording: true, countdown: null, recordingTime: 0 };
        case 'STOP_RECORDING':
            state.audioStream?.getTracks().forEach(track => track.stop());
            return { ...state, isRecording: false, audioStream: null };
        case 'START_PROCESSING':
            return { ...state, isProcessing: true };
        case 'FINISH_PROCESSING':
            const newAnswers = new Map(state.answers);
            newAnswers.set(state.currentIndex, action.answer);
            return { ...state, isProcessing: false, step: 'feedback', answers: newAnswers, isQuestionAudioPlaying: false };
        case 'PROCESSING_ERROR':
            return { ...state, isProcessing: false, step: 'error', error: action.error };
        case 'NEXT_QUESTION':
            if (state.currentIndex < action.questions.length - 1) {
                return { ...state, step: 'question', currentIndex: state.currentIndex + 1, isQuestionAudioPlaying: false };
            }
            return { ...state, step: 'summary', isQuestionAudioPlaying: false };
        case 'RETRY_QUESTION':
            return { ...state, step: 'question', isQuestionAudioPlaying: false };
        case 'TICK_TIMER':
            return { ...state, recordingTime: state.recordingTime + 1 };
        case 'PLAY_QUESTION_AUDIO':
            return { ...state, isQuestionAudioPlaying: true };
        case 'FINISH_QUESTION_AUDIO':
            return { ...state, isQuestionAudioPlaying: false };
        default:
            return state;
    }
}


const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

const RatingDisplay: React.FC<{ label: string; score: number }> = ({ label, score }) => (
    <div className="flex justify-between items-center text-sm">
        <p className="font-medium">{label}</p>
        <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
                <StarIcon key={i} className="w-5 h-5 text-yellow-400" filled={i < score} />
            ))}
        </div>
    </div>
);


const MockInterviewModal: React.FC<MockInterviewModalProps> = ({ isOpen, onClose, questions, jobRole }) => {
  const [state, dispatch] = useReducer(mockInterviewReducer, initialState);
  const { step, currentIndex, isRecording, isProcessing, answers, audioStream, countdown, recordingTime, error, isQuestionAudioPlaying } = state;

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const outputAudioContext = useRef<AudioContext | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isUserAudioPlaying, setIsUserAudioPlaying] = useState(false);
  
  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'START_INTERVIEW' });
      outputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    } else {
      dispatch({ type: 'CLOSE_INTERVIEW' });
      outputAudioContext.current?.close();
      outputAudioContext.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 'question' && isOpen && currentQuestion) {
        const speakQuestion = async () => {
            dispatch({ type: 'PLAY_QUESTION_AUDIO' });
            try {
                const audioData = await textToSpeech(currentQuestion.question);
                if (audioData && outputAudioContext.current) {
                    const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext.current, 24000, 1);
                    const source = outputAudioContext.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputAudioContext.current.destination);
                    source.onended = () => dispatch({ type: 'FINISH_QUESTION_AUDIO' });
                    source.start();
                } else {
                    dispatch({ type: 'FINISH_QUESTION_AUDIO' });
                }
            } catch (e) {
                console.error("Failed to speak question:", e);
                dispatch({ type: 'FINISH_QUESTION_AUDIO' });
            }
        };
        speakQuestion();
    }
  }, [step, isOpen, currentQuestion]);


  const startActualRecording = async () => {
     try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        dispatch({ type: 'REQUEST_PERMISSION_SUCCESS', stream });

        mediaRecorder.current = new MediaRecorder(stream);
        audioChunks.current = [];
        mediaRecorder.current.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunks.current.push(event.data);
        };
        mediaRecorder.current.onstart = () => dispatch({ type: 'START_RECORDING' });
        mediaRecorder.current.start();
    } catch (err) {
      console.error("Microphone access denied:", err);
      dispatch({ type: 'REQUEST_PERMISSION_FAILURE' });
    }
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      startActualRecording();
      return;
    }
    const timer = setTimeout(() => dispatch({ type: 'DECREMENT_COUNTDOWN' }), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);
  
  useEffect(() => {
    let timer: number | undefined;
    if (isRecording) {
      timer = window.setInterval(() => dispatch({ type: 'TICK_TIMER' }), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  const handleStartRecording = () => {
    dispatch({ type: 'START_COUNTDOWN' });
  };

  const handleStopRecording = async () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.onstop = async () => {
        dispatch({ type: 'START_PROCESSING' });
        
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });

        // Revoke the previous URL for this question if it exists, to prevent leaks on retry
        const existingAnswer = answers.get(currentIndex);
        if (existingAnswer?.userAudioUrl) {
            URL.revokeObjectURL(existingAnswer.userAudioUrl);
        }
        
        const userAudioUrl = URL.createObjectURL(audioBlob);

        if (audioBlob.size < 200) { // Check for empty or near-empty recording
            dispatch({ type: 'FINISH_PROCESSING', answer: { userAnswer: "(No audio was detected)", feedback: "It seems no audio was captured. Please ensure your microphone is working correctly and try recording your answer again.", userAudioUrl } });
            return;
        }

        const audioFile = new File([audioBlob], "interview_answer.webm", { type: "audio/webm" });
        
        try {
          const transcribedText = await transcribeAudio(audioFile);
          if (!transcribedText.trim()) {
            dispatch({ type: 'FINISH_PROCESSING', answer: { userAnswer: "(Could not understand audio)", feedback: "We had trouble understanding the audio. Could you please try speaking more clearly and try again?", userAudioUrl } });
          } else {
            const feedback = await generateAnswerFeedback(currentQuestion.question, transcribedText, jobRole);
            dispatch({ type: 'FINISH_PROCESSING', answer: { userAnswer: transcribedText, feedback, userAudioUrl } });
          }
        } catch (err: any) {
          console.error("Error during processing:", err);
          dispatch({ type: 'PROCESSING_ERROR', error: err.message || "An unknown error occurred while processing your answer." });
        }
      };

      mediaRecorder.current.stop();
      dispatch({ type: 'STOP_RECORDING' });
    }
  };

  const handleNext = () => {
    // Stop playback of the current answer's audio before moving on
    if (userAudioRef.current && isUserAudioPlaying) {
        userAudioRef.current.pause();
    }
    setIsUserAudioPlaying(false);
    dispatch({ type: 'NEXT_QUESTION', questions });
  };

  const handleRetry = () => dispatch({ type: 'RETRY_QUESTION' });
  
  const handleClose = () => {
    // Stop any playing audio before closing
    if (userAudioRef.current && isUserAudioPlaying) {
      userAudioRef.current.pause();
    }
    // Revoke all created blob URLs to prevent memory leaks
    answers.forEach(answer => {
      if (answer.userAudioUrl) {
        URL.revokeObjectURL(answer.userAudioUrl);
      }
    });
    onClose();
  };

  const toggleUserAudioPlayback = () => {
    if (userAudioRef.current) {
        if (isUserAudioPlaying) {
            userAudioRef.current.pause();
        } else {
            userAudioRef.current.play();
        }
    }
  };


  const renderContent = () => {
    if (isProcessing) {
        return <div className="min-h-[300px] flex items-center justify-center"><LoadingSpinner message="Analyzing your answer..." /></div>;
    }

    switch (step) {
      case 'permission_denied':
      case 'error':
        return (
          <div className="text-center p-4 sm:p-8 min-h-[300px] flex flex-col items-center justify-center">
            <WarningIcon className="w-12 h-12 text-red-500 mb-4"/>
            <h3 className="text-xl font-bold">{step === 'error' ? 'An Error Occurred' : 'Microphone Access Denied'}</h3>
            <p className="mt-2 text-base-content/70 dark:text-dark-content/70">
              {error || 'This feature requires microphone access. Please enable it in your browser settings and try again.'}
            </p>
          </div>
        );
      
      case 'question':
        return (
          <div className="p-4 sm:p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
            <p className="text-base sm:text-lg font-semibold text-base-content/80 dark:text-dark-content/80">Question {currentIndex + 1} of {questions.length}</p>
            <h3 className="text-xl sm:text-2xl font-bold mt-2">{currentQuestion?.question}</h3>
            <div className="mt-8 h-28 flex flex-col items-center justify-center">
              {countdown !== null ? (
                <div className="text-7xl font-bold text-primary animate-ping" style={{ animationIterationCount: 3 }}>{countdown}</div>
              ) : !isRecording ? (
                <>
                    {isQuestionAudioPlaying && (
                        <div className="flex items-center gap-2 text-primary font-semibold animate-pulse mb-4">
                            <Volume2Icon className="w-5 h-5" /> Reading question...
                        </div>
                    )}
                    <button onClick={handleStartRecording} disabled={isQuestionAudioPlaying} className="flex items-center gap-3 px-8 py-4 bg-primary text-primary-content font-bold rounded-full shadow-lg hover:bg-primary-focus transition-all transform hover:scale-105 disabled:bg-base-300 disabled:cursor-not-allowed">
                        <MicrophoneIcon className="w-6 h-6"/> Record Answer
                    </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                    <div className="h-[50px]">
                        {audioStream && <AudioVisualizer stream={audioStream} isRecording={isRecording} />}
                    </div>
                     <p className="font-mono text-sm">{formatTime(recordingTime)}</p>
                    <button onClick={handleStopRecording} className="flex items-center gap-3 px-8 py-4 bg-red-600 text-white font-bold rounded-full shadow-lg animate-pulse">
                        <StopCircleIcon className="w-6 h-6"/> Stop Recording
                    </button>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'feedback':
        const currentAnswer = answers.get(currentIndex);
        const feedback = currentAnswer?.feedback;
        const userAudioUrl = currentAnswer?.userAudioUrl;
        return (
          <div className="p-4 sm:p-8">
            <h3 className="text-xl font-bold mb-4">Feedback on your Answer</h3>
            <div className="space-y-4">
                 <div className="p-4 bg-base-200/50 dark:bg-dark-base-200/50 rounded-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-grow w-full">
                            <p className="font-semibold text-sm mb-2">Your Answer:</p>
                            <p className="italic text-base-content/80 dark:text-dark-content/80">{currentAnswer?.userAnswer}</p>
                        </div>
                        {userAudioUrl && (
                          <>
                            <audio 
                                ref={userAudioRef} 
                                src={userAudioUrl} 
                                onPlay={() => setIsUserAudioPlaying(true)}
                                onPause={() => setIsUserAudioPlaying(false)}
                                onEnded={() => setIsUserAudioPlaying(false)}
                                hidden 
                            />
                            <button onClick={toggleUserAudioPlayback} className="w-full sm:w-auto flex justify-center items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 flex-shrink-0">
                                {isUserAudioPlaying ? <PauseCircleIcon className="w-5 h-5"/> : <PlayCircleIcon className="w-5 h-5"/>}
                                Listen
                            </button>
                          </>
                        )}
                    </div>
                </div>
                <div className="p-4 bg-blue-100/50 dark:bg-blue-900/20 border border-blue-500/30 rounded-lg space-y-4">
                    <p className="font-semibold text-sm text-blue-700 dark:text-blue-300">AI Feedback:</p>
                    {typeof feedback === 'object' ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-4 p-3 bg-base-100 dark:bg-dark-base-200 rounded-md">
                                <RatingDisplay label="Clarity" score={feedback.clarity} />
                                <RatingDisplay label="Structure" score={feedback.structure} />
                                <RatingDisplay label="Relevance" score={feedback.relevance} />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">Overall Impression:</h4>
                                <p className="text-sm mt-1">{feedback.overallImpression}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">Points to Improve:</h4>
                                <ul className="list-disc list-inside space-y-1 mt-1 text-sm">
                                    {feedback.improvementPoints.map((point, i) => <li key={i}>{point}</li>)}
                                </ul>
                            </div>
                            {feedback.followUpQuestion && (
                                <div className="pt-4 mt-4 border-t border-blue-500/20">
                                    <h4 className="font-semibold text-sm">Be prepared for a follow-up like:</h4>
                                    <p className="text-sm mt-1 italic">"{feedback.followUpQuestion}"</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="whitespace-pre-line">{feedback}</p>
                    )}
                </div>
            </div>
          </div>
        );

      case 'summary':
        return (
            <div className="p-4 sm:p-8">
                <h3 className="text-2xl font-bold text-center mb-6">Interview Summary</h3>
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 sm:pr-4">
                    {questions.map((q, i) => {
                        const answer = answers.get(i);
                        const feedback = answer?.feedback;
                        return (
                            <div key={i} className="p-4 border border-base-300 dark:border-dark-base-300/50 rounded-lg">
                                <p className="font-bold">{i + 1}. {q.question}</p>
                                <div className="mt-3 pl-2 sm:pl-4 border-l-2 border-base-300 dark:border-dark-base-300/50">
                                    <p className="text-sm font-semibold text-base-content/70 dark:text-dark-content/70">Your Answer:</p>
                                    <p className="italic text-sm mt-1">{answer?.userAnswer || "Not answered"}</p>
                                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mt-3">AI Feedback:</p>
                                    {typeof feedback === 'object' ? (
                                        <div className="space-y-2 mt-1">
                                            <p className="text-xs">{feedback.overallImpression}</p>
                                            <details className="text-xs">
                                                <summary className="cursor-pointer font-medium">View details</summary>
                                                <div className="pt-2">
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 bg-base-200/50 dark:bg-dark-base-200/50 rounded-md">
                                                        <RatingDisplay label="Clarity" score={feedback.clarity} />
                                                        <RatingDisplay label="Structure" score={feedback.structure} />
                                                        <RatingDisplay label="Relevance" score={feedback.relevance} />
                                                    </div>
                                                </div>
                                            </details>
                                        </div>
                                    ) : (
                                        <p className="text-sm mt-1 whitespace-pre-line">{feedback || "No feedback"}</p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }
  };

  const renderFooter = () => {
    switch (step) {
        case 'feedback':
            return (
                <div className="flex flex-col sm:flex-row gap-2 w-full justify-end">
                    <button onClick={handleRetry} className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20">
                        <RefreshCwIcon className="w-4 h-4" /> Retry Question
                    </button>
                    <button onClick={handleNext} className="w-full sm:w-auto px-6 py-2 bg-primary text-primary-content font-semibold rounded-lg shadow-sm hover:bg-primary-focus">
                        {currentIndex < questions.length - 1 ? 'Next Question' : 'View Summary'}
                    </button>
                </div>
            )
        case 'summary':
        case 'permission_denied':
        case 'error':
            return (
                <button onClick={handleClose} className="w-full sm:w-auto px-6 py-2 bg-primary text-primary-content font-semibold rounded-lg shadow-sm hover:bg-primary-focus">
                    Close
                </button>
            )
        default:
            return <div className="h-[40px]"></div>;
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center animate-fade-in p-4" aria-modal="true" role="dialog">
      <div className="bg-base-100 dark:bg-dark-base-100 rounded-lg shadow-xl w-full max-w-lg md:max-w-3xl transform transition-all animate-modal-in flex flex-col max-h-full">
        <header className="flex items-center justify-between p-4 border-b border-base-300 dark:border-dark-base-300/50">
          <h2 className="text-lg font-bold">Mock Interview: {jobRole}</h2>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-base-200 dark:hover:bg-dark-base-300">
            <XCircleIcon className="w-6 h-6 text-base-content/60 dark:text-dark-content/60" />
          </button>
        </header>
        <main className="flex-grow overflow-y-auto">
            {renderContent()}
        </main>
        <footer className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-t border-base-300 dark:border-dark-base-300/50">
             <div className="flex items-center gap-2 text-xs sm:text-sm text-base-content/60 dark:text-dark-content/60">
                <InfoIcon className="w-4 h-4 flex-shrink-0" />
                <p>Your audio is processed for transcription and is not stored.</p>
            </div>
            {renderFooter()}
        </footer>
      </div>
    </div>
  );
};

export default MockInterviewModal;