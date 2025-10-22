import React, { useState, useEffect } from 'react';
import { NeuralSparkIcon, SunIcon, MoonIcon } from './Icons';

type Theme = 'light' | 'dark';

interface HeaderProps {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const Header: React.FC<HeaderProps> = ({ theme, setTheme }) => {
    const [scrolled, setScrolled] = useState(false);

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

  return (
    <header className={`sticky top-0 z-20 transition-all duration-300 ${scrolled ? 'bg-base-100/80 dark:bg-dark-base-100/80 backdrop-blur-sm shadow-md' : 'bg-transparent'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <NeuralSparkIcon className="h-8 w-8 text-primary" />
            <h1 className="ml-3 text-xl sm:text-2xl font-bold text-base-content dark:text-dark-content">
              AI Interview Prep
            </h1>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-base-content/70 dark:text-yellow-400 hover:bg-base-200 hover:text-base-content dark:hover:bg-dark-base-300 dark:hover:text-yellow-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 dark:focus-visible:ring-offset-dark-base-100 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;