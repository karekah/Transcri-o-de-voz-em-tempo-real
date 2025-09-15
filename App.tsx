import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";

// --- Gemini AI Client Initialization ---
// It's safe to use the API key here because this code runs in a trusted environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Type Definitions ---
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

interface Session {
  id: number;
  transcript: string;
  analysis?: {
    accuracy: string;
    explanation: string;
    sources?: Array<{
        uri: string;
        title: string;
    }>;
  };
  status: 'pending' | 'completed' | 'error';
  error?: string;
}

// --- SVG Icon Components ---
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

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
);

const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.41 14.59L6 12l1.41-1.41L10.59 12l4.58-4.59L16.59 9 12 13.59l4.59 4.59L15 19.59 10.59 15z" opacity=".8"/>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 13.59L15 17l-4.59-4.59L6 17l-1.41-1.41L10.59 12 6 7.41 7.41 6 12 10.59 16.59 6 18 7.41 13.41 12l4.59 4.59z"/>
    </svg>
);

const QuestionMarkCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z"/>
    </svg>
);

const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 7H13.41L16.71 3.71L15.29 2.29L12 5.59V2H10V5.59L6.7 2.29L5.29 3.71L8.59 7H5C3.9 7 3 7.9 3 9V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V9C21 7.9 20.1 7 19 7ZM19 19H5V9H19V19Z" />
      <path d="M13.25 12.75H10.75V10.25C10.75 9.69 10.31 9.25 9.75 9.25S8.75 9.69 8.75 10.25V12.75H6.25C5.69 12.75 5.25 13.19 5.25 13.75S5.69 14.75 6.25 14.75H8.75V17.25C8.75 17.81 9.19 18.25 9.75 18.25S10.75 17.81 10.75 17.25V14.75H13.25C13.81 14.75 14.25 14.31 14.25 13.75S13.81 12.75 13.25 12.75Z" opacity="0.3" />
      <path d="M12 12c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4S14.21 12 12 12ZM12 18c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2S13.1 18 12 18Z" opacity="0.3" />
      <path d="M10 11h4v2h-4z" opacity="0.3" />
    </svg>
);

// --- Supported Languages ---
const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' }, { code: 'es-ES', name: 'Español (España)' }, { code: 'fr-FR', name: 'Français' }, { code: 'de-DE', name: 'Deutsch' }, { code: 'it-IT', name: 'Italiano' }, { code: 'ja-JP', name: '日本語' }, { code: 'ko-KR', name: '한국어' }, { code: 'pt-BR', name: 'Português (Brasil)' }, { code: 'ru-RU', name: 'Русский' }, { code: 'zh-CN', name: '中文 (普通话)' }, { code: 'hi-IN', name: 'हिन्दी' },
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
  const [sessions, setSessions] = useState<Session[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  const transcriptRef = useRef(transcript);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  const errorRef = useRef(error);
  useEffect(() => { errorRef.current = error; }, [error]);

  const analyzeTranscript = useCallback(async (sessionId: number, transcriptToAnalyze: string) => {
    try {
      const prompt = `Analyze the following statement for factual accuracy. Start your response with one of three words: 'True', 'False', or 'Uncertain', followed by a colon, and then a brief, one-sentence explanation. Statement: "${transcriptToAnalyze}"`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        },
      });
      
      const responseText = response.text;
      const accuracyMatch = responseText.match(/^(True|False|Uncertain):/i);
      
      let analysis: { accuracy: string; explanation: string; sources?: any[] };

      if (accuracyMatch) {
        const accuracy = accuracyMatch[1].charAt(0).toUpperCase() + accuracyMatch[1].slice(1).toLowerCase();
        const explanation = responseText.substring(accuracyMatch[0].length).trim();
        analysis = { accuracy, explanation };
      } else {
        // Fallback if the model doesn't follow instructions perfectly
        analysis = { accuracy: 'Uncertain', explanation: responseText };
      }
      
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web)
        .filter((web: any) => web?.uri && web?.title) || [];

      analysis.sources = sources;
      
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'completed', analysis } : s));
    } catch (err) {
      console.error("Error analyzing transcript:", err);
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'error', error: 'Failed to analyze transcript.' } : s));
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

    recognition.onstart = () => { setStatus('idle'); setError(null); };
    
    recognition.onend = () => {
        if (errorRef.current) { setStatus('error'); return; }
        recognitionRef.current?.start();
    };
    
    recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        
        setError(event.error === 'audio-capture' 
          ? "Microphone not available. Check your microphone settings."
          : "Microphone access denied. Please allow it in your browser settings."
        );
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
        if (!stopTimerRef.current) {
            stopTimerRef.current = window.setTimeout(() => { recognitionRef.current?.stop(); }, 1000);
        }
    };

    recognition.onresult = (event: any) => {
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
        setIsSpeaking(true);
        setStatus('listening');
        
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
            const result = event.results[i];
            if (result.isFinal && result[0].confidence > CONFIDENCE_THRESHOLD) {
                finalTranscript += result[0].transcript;
            } else {
                interimTranscript += result[0].transcript;
            }
        }
        setTranscript(finalTranscript + interimTranscript);
        
        const isLastResultFinal = event.results[event.results.length - 1].isFinal;
        if (isLastResultFinal) {
            stopTimerRef.current = window.setTimeout(() => {
                const finalTranscriptText = (finalTranscript + interimTranscript).trim();
                if (finalTranscriptText) {
                    const newSessionId = Date.now();
                    const newSession: Session = { id: newSessionId, transcript: finalTranscriptText, status: 'pending' };
                    setSessions(prev => [newSession, ...prev]);
                    analyzeTranscript(newSessionId, finalTranscriptText);
                }
                setTranscript('');
                recognitionRef.current?.stop();
            }, 1000);
        }
    };

    recognition.start();

    return () => {
      recognition.onend = null;
      recognition.stop();
    };
  }, [language, analyzeTranscript]);

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

  const handleClear = useCallback(() => { setTranscript(''); }, []);
  
  const StatusIndicator = () => {
    if (status === 'error') return <div className="text-red-400 font-medium text-center">{error}</div>;
    if (status === 'listening') {
        return (
          <div className="text-cyan-400 font-medium text-center flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span></span>
            Listening...
          </div>
        );
    }
    if (status === 'detecting') return <div className="text-slate-400 font-medium text-center">Sound detected...</div>;
    if (status === 'initializing') return <div className="text-slate-400 font-medium text-center">Initializing microphone...</div>;
    return <div className="text-slate-400 font-medium text-center flex items-center justify-center gap-2"><MicrophoneIcon className="w-5 h-5" /> Ready to listen</div>;
  };
  
  const AnalysisResult = ({ session }: { session: Session }) => {
    switch (session.status) {
        case 'pending': return <div className="flex items-center gap-2 text-slate-400"><SpinnerIcon className="w-5 h-5 animate-spin" /><span>Analyzing...</span></div>;
        case 'error': return <div className="text-red-400">{session.error}</div>;
        case 'completed':
            const accuracy = session.analysis?.accuracy.toLowerCase() ?? '';
            const color = accuracy === 'true' ? 'text-green-400' : accuracy === 'false' ? 'text-red-400' : 'text-yellow-400';
            const Icon = accuracy === 'true' ? CheckCircleIcon : accuracy === 'false' ? XCircleIcon : QuestionMarkCircleIcon;
            return (
                <div className="space-y-2">
                    <div className={`flex items-center gap-2 font-semibold ${color}`}>
                        <Icon className="w-6 h-6" />
                        <span className="uppercase">{session.analysis?.accuracy}</span>
                    </div>
                    <p className="text-slate-400">{session.analysis?.explanation}</p>
                    {session.analysis?.sources && session.analysis.sources.length > 0 && (
                      <div className="pt-3">
                        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                          <LinkIcon className="w-4 h-4" />
                          Sources
                        </h4>
                        <ul className="space-y-2">
                          {session.analysis.sources.map((source, index) => (
                            <li key={index}>
                              <a
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block group p-3 rounded-lg transition-colors hover:bg-slate-800/60 border border-transparent hover:border-slate-700"
                                title={source.uri}
                              >
                                <span className="font-medium text-cyan-400 block truncate group-hover:whitespace-normal">
                                  {source.title}
                                </span>
                                <span className="text-slate-500 block truncate group-hover:whitespace-normal text-xs">
                                  {source.uri}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
            );
        default: return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-4xl mx-auto flex flex-col h-[90vh]">
        <header className="text-center mb-6 flex-shrink-0">
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">Real-time fact checking</h1>
          <p className="text-slate-400 mt-2 text-lg">Your words, captured & fact-checked instantly.</p>
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
                {LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
            </select>
          </div>
        </header>

        <div ref={transcriptContainerRef} className={`flex-grow bg-slate-800/50 rounded-lg shadow-inner p-6 overflow-y-auto transition-all duration-300 min-h-24 ${isSpeaking ? 'ring-2 ring-cyan-500' : 'ring-1 ring-slate-700/50'}`}>
          <p className="text-lg sm:text-xl leading-relaxed whitespace-pre-wrap">
            {transcript || <span className="text-slate-500">Transcript will appear here...</span>}
          </p>
        </div>
        
        <div className="flex-shrink-0 pt-6">
          <div className="text-center mb-6 h-6"><StatusIndicator /></div>
          <div className="flex items-center justify-center gap-4">
             <button onClick={handleClear} disabled={!transcript} className="p-3 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500" aria-label="Clear transcript">
                <TrashIcon className="w-6 h-6" />
            </button>
             <button onClick={handleCopy} disabled={!transcript} className="p-4 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500" aria-label="Copy transcript">
              {isCopied ? <svg className="w-7 h-7 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> : <CopyIcon className="w-7 h-7" />}
            </button>
          </div>
        </div>

        <div className="flex-grow mt-8 flex flex-col min-h-0">
            <h2 className="text-2xl font-bold text-center mb-4 text-white">Analysis History</h2>
            <div className="flex-grow bg-slate-800/50 rounded-lg p-4 space-y-4 overflow-y-auto ring-1 ring-slate-700/50">
                {sessions.length === 0 ? (
                    <div className="text-center text-slate-500 h-full flex items-center justify-center">Your fact-checked sessions will appear here.</div>
                ) : (
                    sessions.map(session => (
                        <div key={session.id} className="bg-slate-900/70 p-4 rounded-lg border border-slate-700">
                            <p className="text-slate-200 text-lg mb-3">"{session.transcript}"</p>
                            <hr className="border-slate-700 my-3" />
                            <AnalysisResult session={session} />
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>
    </div>
  );
}