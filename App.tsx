import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Type Definition for Web Speech API ---
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onresult: ((event: any) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// --- SVG Icon Components (defined outside App to prevent re-creation) ---
const MicrophoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM18.999 13a1 1 0 1 0-1.998 0A5.002 5.002 0 0 1 12 18a5 5 0 0 1-5-5 1 1 0 1 0-2 0a7 7 0 0 0 6 6.93V22h-3a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07A7.002 7.002 0 0 0 18.999 13z" />
  </svg>
);

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
);

// --- Supported Languages ---
const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'es-ES', name: 'Español (España)' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'it-IT', name: 'Italiano' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'ru-RU', name: 'Русский' },
  { code: 'zh-CN', name: '中文 (普通话)' },
  { code: 'hi-IN', name: 'हिन्दी' },
];

const CONFIDENCE_THRESHOLD = 0.5;

type Status = 'idle' | 'listening' | 'error' | 'initializing' | 'detecting';

// --- Main App Component ---
export default function App() {
  const [status, setStatus] = useState<Status>('initializing');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [autosaveMessage, setAutosaveMessage] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const lastSavedTranscriptRef = useRef('');

  // Use refs to hold the latest state to avoid stale closures in callbacks
  const transcriptRef = useRef(transcript);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const errorRef = useRef(error);
  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  const handleSave = useCallback((isAutosave = false) => {
    const contentToSave = transcriptRef.current;
    if (contentToSave && contentToSave !== lastSavedTranscriptRef.current) {
        const blob = new Blob([contentToSave], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `transcript-${timestamp}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        lastSavedTranscriptRef.current = contentToSave;

        if (isAutosave) {
            setAutosaveMessage('Transcript autosaved.');
            setTimeout(() => setAutosaveMessage(''), 3000);
        }
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please try Chrome or Edge.");
      setStatus('error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setStatus('idle');
      setError(null);
    };
    
    // The main loop: onend, we restart recognition to keep listening.
    recognition.onend = () => {
        // Don't restart if there was a fatal error or during language change.
        if (errorRef.current) {
            setStatus('error');
            return;
        }
        // The transcript is cleared by the stop timer. We just need to restart listening.
        recognitionRef.current?.start();
    };
    
    recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // These are not fatal. The onend handler will restart the recognition.
          return;
        }
        
        if (event.error === 'audio-capture' || event.error === 'not-allowed') {
          setError(event.error === 'audio-capture' 
            ? "Microphone is not available. Check your microphone settings."
            : "Microphone access denied. Please allow it in your browser settings."
          );
        } else {
          setError(`An error occurred: ${event.error}`);
        }
        setStatus('error');
    };
    
    recognition.onspeechstart = () => {
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
        setStatus('detecting');
    };

    recognition.onspeechend = () => {
        setIsSpeaking(false);
        setStatus('idle');
        // Fallback timer: If speech ends but we never got a final result (e.g., mumbled sound),
        // we still want to reset the session. This timer will only run if the onresult timer isn't active.
        if (!stopTimerRef.current) {
            stopTimerRef.current = window.setTimeout(() => {
                recognitionRef.current?.stop(); // Just stop and restart, no save/clear.
            }, 1000);
        }
    };

    recognition.onresult = (event: any) => {
        // A result is received, so we are definitely not stopping yet.
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;

        // Confirmed speech detected.
        setIsSpeaking(true);
        setStatus('listening');
        
        let finalTranscript = '';
        let interimTranscript = '';
      
        for (let i = 0; i < event.results.length; ++i) {
            const result = event.results[i];
            const alternative = result[0];
            if (result.isFinal) {
                if (alternative.confidence > CONFIDENCE_THRESHOLD) {
                    finalTranscript += alternative.transcript;
                }
            } else {
                interimTranscript += alternative.transcript;
            }
        }
      
        setTranscript(finalTranscript + interimTranscript);
        
        // If the last result is final, it marks the end of a confirmed utterance.
        // This is our signal to start the 1-second timer to finalize this segment.
        const isLastResultFinal = event.results[event.results.length - 1].isFinal;
        if (isLastResultFinal) {
            stopTimerRef.current = window.setTimeout(() => {
                if (transcriptRef.current.trim()) {
                    handleSave(true);
                }
                // Clear transcript state for the next utterance.
                setTranscript('');
                lastSavedTranscriptRef.current = '';

                recognitionRef.current?.stop(); // Triggers onend, which restarts the session.
            }, 1000);
        }
    };

    // Start listening on component mount.
    recognition.start();

    // Cleanup: stop recognition when component unmounts or language changes.
    return () => {
      recognition.onend = null; // Prevent restart during cleanup
      recognition.stop();
    };
  }, [language, handleSave]);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleCopy = useCallback(() => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }, [transcript]);

  const handleClear = useCallback(() => {
    setTranscript('');
    lastSavedTranscriptRef.current = '';
  }, []);
  
  const StatusIndicator = () => {
    if (status === 'error') return <div className="text-red-400 font-medium text-center">{error}</div>;
    if (status === 'listening') {
        return (
          <div className="text-cyan-400 font-medium text-center flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
            Listening...
          </div>
        );
    }
    if (status === 'detecting') {
        return <div className="text-slate-400 font-medium text-center">Sound detected...</div>;
    }
    if (status === 'initializing') {
        return <div className="text-slate-400 font-medium text-center">Initializing microphone...</div>;
    }
    return <div className="text-slate-400 font-medium text-center flex items-center justify-center gap-2"><MicrophoneIcon className="w-5 h-5" /> Ready to listen</div>;
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-4xl mx-auto flex flex-col h-[85vh]">
        <header className="text-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">Real-time Transcription</h1>
          <p className="text-slate-400 mt-2 text-lg">Your words, captured instantly. Voice-activated.</p>
          <div className="mt-6 max-w-xs mx-auto">
            <label htmlFor="language-select" className="sr-only">Select Language</label>
            <select
                id="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                aria-label="Select transcription language"
                disabled={status === 'listening' || status === 'detecting'}
            >
                {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                        {lang.name}
                    </option>
                ))}
            </select>
          </div>
        </header>

        <div 
          ref={transcriptContainerRef} 
          className={`flex-grow bg-slate-800/50 rounded-lg shadow-inner p-6 overflow-y-auto transition-all duration-300 ${
            isSpeaking ? 'ring-2 ring-cyan-500' : 'ring-1 ring-slate-700/50'
          }`}
        >
          <p className="text-lg sm:text-xl leading-relaxed whitespace-pre-wrap">
            {transcript || <span className="text-slate-500">Transcript will appear here...</span>}
          </p>
        </div>
        
        <div className="flex-shrink-0 pt-6">
          <div className="text-center mb-6 h-6">
            <StatusIndicator />
          </div>
          <div className="flex items-center justify-center gap-4">
             <button
                onClick={handleClear}
                disabled={!transcript || status === 'listening' || status === 'detecting'}
                className="p-3 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500"
                aria-label="Clear transcript"
            >
                <TrashIcon className="w-6 h-6" />
            </button>
             <button
                onClick={handleCopy}
                disabled={!transcript || status === 'listening' || status === 'detecting'}
                className="p-4 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500"
                aria-label="Copy transcript"
            >
              {isCopied ? (
                  <svg className="w-7 h-7 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              ) : (
                  <CopyIcon className="w-7 h-7" />
              )}
            </button>
             <button
                onClick={() => handleSave(false)}
                disabled={!transcript || status === 'listening' || status === 'detecting'}
                className="p-3 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500"
                aria-label="Save transcript to file"
            >
                <DownloadIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
      {autosaveMessage && (
        <div className="fixed bottom-5 right-5 bg-slate-700 text-white py-2 px-4 rounded-lg shadow-lg z-50 transition-opacity duration-300 animate-pulse">
          {autosaveMessage}
        </div>
      )}
    </div>
  );
}
