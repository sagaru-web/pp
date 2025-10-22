import React, { useState, useMemo } from 'react';
import { InterviewQuestion, QuestionCategory } from '../types';
import { ChevronDownIcon, ThumbsUpIcon, ThumbsDownIcon } from './Icons';

interface QuestionCardProps {
  item: InterviewQuestion;
  index: number;
}

const categoryStyles: { [key in QuestionCategory]: { bg: string, text: string, border: string } } = {
  [QuestionCategory.HR]: {
    bg: 'bg-blue-200/60 dark:bg-blue-500/10',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-500'
  },
  [QuestionCategory.Technical]: {
    bg: 'bg-emerald-200/60 dark:bg-emerald-500/10',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-500'
  },
  [QuestionCategory.Behavioral]: {
    bg: 'bg-violet-200/60 dark:bg-violet-500/10',
    text: 'text-violet-800 dark:text-violet-300',
    border: 'border-violet-500'
  },
};

const AnswerRenderer: React.FC<{ text: string }> = ({ text }) => {
    const formattedAnswer = useMemo(() => {
        const starKeywords = /^(Situation:|Task:|Action:|Result:)/i;
        return text.split('\n').map((line, index) => {
            const trimmedLine = line.trim();
            if (starKeywords.test(trimmedLine)) {
                const parts = trimmedLine.split(/:(.*)/s);
                return (
                    <p key={index} className="mt-2">
                        <strong className="font-semibold text-base-content dark:text-dark-content">{parts[0]}:</strong>
                        <span>{parts[1]}</span>
                    </p>
                );
            } else if (trimmedLine.startsWith('- ')) {
                 return <li key={index} className="ml-5">{trimmedLine.substring(2)}</li>;
            }
            return <p key={index}>{line}</p>;
        });
    }, [text]);

    return <>{formattedAnswer}</>;
};


const QuestionCard: React.FC<QuestionCardProps> = ({ item, index }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  
  const styles = categoryStyles[item.category] || { bg: 'bg-gray-200', text: 'text-gray-800', border: 'border-gray-500' };

  return (
    <div 
      className={`border border-base-300 dark:border-dark-base-300/50 bg-base-100/50 dark:bg-dark-base-100/50 backdrop-blur-sm rounded-lg shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 border-l-4 ${styles.border} animate-stagger-in`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3"
        aria-expanded={isOpen}
      >
        <div className="flex items-start w-full pr-0 sm:pr-4">
            <span className="text-primary font-bold mr-3 text-lg">{index + 1}.</span>
            <span className="font-semibold text-base-content dark:text-dark-content">{item.question}</span>
        </div>
        <div className="flex items-center justify-end sm:justify-start w-full sm:w-auto flex-shrink-0 mt-2 sm:mt-0">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles.bg} ${styles.text}`}>
                {item.category}
            </span>
            <ChevronDownIcon className={`w-5 h-5 ml-4 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
            <div className="px-4 pb-4">
              <div className="p-4 border-t border-base-200 dark:border-dark-base-300/50 bg-base-200/50 dark:bg-dark-base-200/50 rounded-md">
                <h4 className="font-semibold text-base-content dark:text-dark-content mb-2">Suggested Answer:</h4>
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-base-content/90 dark:text-dark-content/80 whitespace-pre-line leading-relaxed">
                  <AnswerRenderer text={item.suggestedAnswer} />
                </div>
                
                <div className="mt-4 pt-4 border-t border-base-300/70 dark:border-dark-base-300/70">
                  {!feedback ? (
                    <div className="flex justify-end items-center gap-2">
                      <p className="text-sm text-base-content/70 dark:text-dark-content/70">Was this helpful?</p>
                      <div className="tooltip">
                        <button 
                          onClick={() => setFeedback('positive')}
                          className="p-1.5 rounded-full text-base-content/60 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-500/10 dark:hover:text-green-400"
                          aria-label="Helpful answer"
                        >
                          <ThumbsUpIcon className="w-5 h-5" />
                        </button>
                        <span className="tooltip-text">Helpful</span>
                      </div>
                      <div className="tooltip">
                        <button 
                          onClick={() => setFeedback('negative')}
                          className="p-1.5 rounded-full text-base-content/60 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          aria-label="Not helpful answer"
                        >
                          <ThumbsDownIcon className="w-5 h-5" />
                        </button>
                        <span className="tooltip-text">Not Helpful</span>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-sm font-semibold text-right ${feedback === 'positive' ? 'text-green-600 dark:text-green-400' : 'text-base-content dark:text-dark-content'}`}>
                      {feedback === 'positive' 
                          ? "Thanks for your feedback!" 
                          : "We appreciate your feedback. It will be used for improvements."
                      }
                  </p>
                  )}
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionCard;