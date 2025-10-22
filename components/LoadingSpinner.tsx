import React from 'react';

const LoadingSpinner: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-base-100/50 dark:bg-dark-base-100/50 rounded-lg backdrop-blur-sm">
      <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-primary"></div>
      <p className="mt-4 text-lg font-semibold text-base-content dark:text-dark-content">{message}</p>
      <p className="mt-1 text-sm text-base-content/60 dark:text-dark-content/60">This may take a moment...</p>
    </div>
  );
};

export default LoadingSpinner;