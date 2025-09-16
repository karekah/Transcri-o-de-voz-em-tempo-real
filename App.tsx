

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";

// --- Gemini AI Client Initialization ---
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
    accuracy: 'True' | 'False' | 'Uncertain';
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

const EllipsisIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </svg>
);

// --- Translations ---
type Translation = {
  title: string;
  subtitle: string;
  selectLanguage: string;
  selectTranscriptionLanguage: string;
  transcriptPlaceholder: string;
  statusListening: string;
  statusInitializing: string;
  statusReady: string;
  statusWaiting: string;
  clearTranscript: string;
  copyTranscript: string;
  analysisHistory: string;
  historyPlaceholder: string;
  analyzing: string;
  analysisFailed: string;
  sources: string;
  errorNotSupported: string;
  errorMicNotAvailable: string;
  errorMicAccessDenied: string;
  prompt: (transcript: string, langName: string) => string;
  keywords: {
    true: string;
    false: string;
    uncertain: string;
  };
};

const enUSTranslation: Translation = {
  title: 'Real-time fact checking',
  subtitle: 'Your words, captured & fact-checked instantly.',
  selectLanguage: 'Select Language',
  selectTranscriptionLanguage: 'Select transcription language',
  transcriptPlaceholder: 'Transcript will appear here...',
  statusListening: 'Listening...',
  statusInitializing: 'Initializing microphone...',
  statusReady: 'Ready to listen',
  statusWaiting: 'Waiting for statement to end...',
  clearTranscript: 'Clear transcript',
  copyTranscript: 'Copy transcript',
  analysisHistory: 'Analysis History',
  historyPlaceholder: 'Your fact-checked sessions will appear here.',
  analyzing: 'Analyzing...',
  analysisFailed: 'Failed to analyze transcript.',
  sources: 'Sources',
  errorNotSupported: 'Speech recognition is not supported in this browser. Please try Chrome or Edge.',
  errorMicNotAvailable: 'Microphone not available. Check your microphone settings.',
  errorMicAccessDenied: 'Microphone access denied. Please allow it in your browser settings.',
  prompt: (transcript, langName) => `Analyze the following statement for factual accuracy. Start your response with one of three words: 'True', 'False', or 'Uncertain', followed by a colon, and then a brief, one-sentence explanation in ${langName}. Statement: "${transcript}"`,
  keywords: { true: 'True', false: 'False', uncertain: 'Uncertain' }
};

const translations: Record<string, Translation> = {
  'en-US': enUSTranslation,
  'es-ES': {
    title: 'Verificación de hechos en tiempo real',
    subtitle: 'Tus palabras, capturadas y verificadas al instante.',
    selectLanguage: 'Seleccionar idioma',
    selectTranscriptionLanguage: 'Seleccionar idioma de transcripción',
    transcriptPlaceholder: 'La transcripción aparecerá aquí...',
    statusListening: 'Escuchando...',
    statusInitializing: 'Inicializando micrófono...',
    statusReady: 'Listo para escuchar',
    statusWaiting: 'Esperando a que termine la declaración...',
    clearTranscript: 'Limpiar transcripción',
    copyTranscript: 'Copiar transcripción',
    analysisHistory: 'Historial de análisis',
    historyPlaceholder: 'Tus sesiones verificadas aparecerán aquí.',
    analyzing: 'Analizando...',
    analysisFailed: 'Fallo al analizar la transcripción.',
    sources: 'Fuentes',
    errorNotSupported: 'El reconocimiento de voz no es compatible con este navegador. Por favor, prueba con Chrome o Edge.',
    errorMicNotAvailable: 'Micrófono no disponible. Revisa la configuración de tu micrófono.',
    errorMicAccessDenied: 'Acceso al micrófono denegado. Por favor, permítelo en la configuración de tu navegador.',
    prompt: (transcript, langName) => `Analiza la siguiente afirmación para verificar su veracidad. Comienza tu respuesta con una de estas tres palabras: 'Verdadero', 'Falso' o 'Incierto', seguida de dos puntos y luego una breve explicación de una oración en ${langName}. Afirmación: "${transcript}"`,
    keywords: { true: 'Verdadero', false: 'Falso', uncertain: 'Incierto' }
  },
  'fr-FR': {
    title: 'Vérification des faits en temps réel',
    subtitle: 'Vos mots, capturés et vérifiés instantanément.',
    selectLanguage: 'Sélectionner la langue',
    selectTranscriptionLanguage: 'Sélectionner la langue de transcription',
    transcriptPlaceholder: 'La transcription apparaîtra ici...',
    statusListening: 'Écoute en cours...',
    statusInitializing: 'Initialisation du microphone...',
    statusReady: 'Prêt à écouter',
    statusWaiting: 'En attente de la fin de la déclaration...',
    clearTranscript: 'Effacer la transcription',
    copyTranscript: 'Copier la transcription',
    analysisHistory: 'Historique des analyses',
    historyPlaceholder: 'Vos sessions vérifiées apparaîtront ici.',
    analyzing: 'Analyse en cours...',
    analysisFailed: 'Échec de l\'analyse de la transcription.',
    sources: 'Sources',
    errorNotSupported: 'La reconnaissance vocale n\'est pas prise en charge par ce navigateur. Veuillez essayer Chrome ou Edge.',
    errorMicNotAvailable: 'Microphone non disponible. Vérifiez les paramètres de votre microphone.',
    errorMicAccessDenied: 'Accès au microphone refusé. Veuillez l\'autoriser dans les paramètres de votre navigateur.',
    prompt: (transcript, langName) => `Analysez l'exactitude factuelle de la déclaration suivante. Commencez votre réponse par l'un des trois mots suivants : 'Vrai', 'Faux' ou 'Incertain', suivi de deux points, puis d'une brève explication d'une phrase en ${langName}. Déclaration : "${transcript}"`,
    keywords: { true: 'Vrai', false: 'Faux', uncertain: 'Incertain' }
  },
  'de-DE': { 
    title: 'Echtzeit-Faktencheck',
    subtitle: 'Ihre Worte, sofort erfasst und auf Fakten geprüft.',
    selectLanguage: 'Sprache auswählen',
    selectTranscriptionLanguage: 'Transkriptionssprache auswählen',
    transcriptPlaceholder: 'Transkript wird hier erscheinen...',
    statusListening: 'Höre zu...',
    statusInitializing: 'Mikrofon wird initialisiert...',
    statusReady: 'Bereit zum Zuhören',
    statusWaiting: 'Warte auf das Ende der Aussage...',
    clearTranscript: 'Transkript löschen',
    copyTranscript: 'Transkript kopieren',
    analysisHistory: 'Analyse-Verlauf',
    historyPlaceholder: 'Ihre auf Fakten geprüften Sitzungen werden hier erscheinen.',
    analyzing: 'Analysiere...',
    analysisFailed: 'Analyse des Transkripts fehlgeschlagen.',
    sources: 'Quellen',
    errorNotSupported: 'Spracherkennung wird in diesem Browser nicht unterstützt. Bitte versuchen Sie es mit Chrome oder Edge.',
    errorMicNotAvailable: 'Mikrofon nicht verfügbar. Überprüfen Sie Ihre Mikrofoneinstellungen.',
    errorMicAccessDenied: 'Mikrofonzugriff verweigert. Bitte erlauben Sie ihn in Ihren Browsereinstellungen.',
    prompt: (transcript, langName) => `Analysieren Sie die folgende Aussage auf ihre sachliche Richtigkeit. Beginnen Sie Ihre Antwort mit einem der drei Wörter: 'Wahr', 'Falsch' oder 'Unsicher', gefolgt von einem Doppelpunkt und dann einer kurzen Erklärung in einem Satz auf ${langName}. Aussage: "${transcript}"`, 
    keywords: { true: 'Wahr', false: 'Falsch', uncertain: 'Unsicher' } 
  },
  'it-IT': { 
    title: 'Controllo dei fatti in tempo reale',
    subtitle: 'Le tue parole, catturate e verificate all\'istante.',
    selectLanguage: 'Seleziona la lingua',
    selectTranscriptionLanguage: 'Seleziona la lingua di trascrizione',
    transcriptPlaceholder: 'La trascrizione apparirà qui...',
    statusListening: 'In ascolto...',
    statusInitializing: 'Inizializzazione del microfono...',
    statusReady: 'Pronto per l\'ascolto',
    statusWaiting: 'In attesa della fine della dichiarazione...',
    clearTranscript: 'Cancella trascrizione',
    copyTranscript: 'Copia trascrizione',
    analysisHistory: 'Cronologia analisi',
    historyPlaceholder: 'Le tue sessioni verificate appariranno qui.',
    analyzing: 'Analisi in corso...',
    analysisFailed: 'Analisi della trascrizione non riuscita.',
    sources: 'Fonti',
    errorNotSupported: 'Il riconoscimento vocale non è supportato in questo browser. Prova con Chrome o Edge.',
    errorMicNotAvailable: 'Microfono non disponibile. Controlla le impostazioni del microfono.',
    errorMicAccessDenied: 'Accesso al microfono negato. Per favore, consentilo nelle impostazioni del browser.',
    prompt: (transcript, langName) => `Analizza la seguente affermazione per l'accuratezza dei fatti. Inizia la tua risposta con una delle tre parole: 'Vero', 'Falso' o 'Incerto', seguita da due punti e poi una breve spiegazione di una frase in ${langName}. Dichiarazione: "${transcript}"`, 
    keywords: { true: 'Vero', false: 'Falso', uncertain: 'Incerto' } 
  },
  'ja-JP': { 
    title: 'リアルタイムファクトチェック',
    subtitle: 'あなたの言葉を即座に捉え、事実確認します。',
    selectLanguage: '言語を選択',
    selectTranscriptionLanguage: '文字起こしの言語を選択',
    transcriptPlaceholder: 'ここに文字起こしが表示されます...',
    statusListening: '聞き取り中...',
    statusInitializing: 'マイクを初期化しています...',
    statusReady: '聞き取り準備完了',
    statusWaiting: '発言の終了を待っています...',
    clearTranscript: '文字起こしをクリア',
    copyTranscript: '文字起こしをコピー',
    analysisHistory: '分析履歴',
    historyPlaceholder: '事実確認されたセッションがここに表示されます。',
    analyzing: '分析中...',
    analysisFailed: '文字起こしの分析に失敗しました。',
    sources: '情報源',
    errorNotSupported: 'このブラウザでは音声認識がサポートされていません。ChromeまたはEdgeをお試しください。',
    errorMicNotAvailable: 'マイクが利用できません。マイクの設定を確認してください。',
    errorMicAccessDenied: 'マイクへのアクセスが拒否されました。ブラウザの設定で許可してください。',
    prompt: (transcript, langName) => `次の記述の事実の正確性を分析してください。回答は「真実」、「偽り」、「不確か」のいずれかの単語で始め、コロンを付け、次に${langName}で短い一文の説明を続けてください。記述：「${transcript}」`, 
    keywords: { true: '真実', false: '偽り', uncertain: '不確か' } 
  },
  'ko-KR': { 
    title: '실시간 팩트 체크',
    subtitle: '당신의 말을 즉시 포착하고 사실을 확인합니다。',
    selectLanguage: '언어 선택',
    selectTranscriptionLanguage: '음성 인식 언어 선택',
    transcriptPlaceholder: '여기에 녹취록이 표시됩니다...',
    statusListening: '듣는 중...',
    statusInitializing: '마이크 초기화 중...',
    statusReady: '들을 준비 완료',
    statusWaiting: '문장이 끝나기를 기다리는 중...',
    clearTranscript: '녹취록 지우기',
    copyTranscript: '녹취록 복사하기',
    analysisHistory: '분석 기록',
    historyPlaceholder: '사실 확인된 세션이 여기에 표시됩니다.',
    analyzing: '분석 중...',
    analysisFailed: '녹취록 분석에 실패했습니다.',
    sources: '출처',
    errorNotSupported: '이 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해 보세요.',
    errorMicNotAvailable: '마이크를 사용할 수 없습니다. 마이크 설정을 확인하세요.',
    errorMicAccessDenied: '마이크 접근이 거부되었습니다. 브라우저 설정에서 허용해 주세요.',
    prompt: (transcript, langName) => `다음 진술의 사실 정확도를 분석하십시오. 답변은 '사실', '거짓' 또는 '불확실' 세 단어 중 하나로 시작하고 콜론을 붙인 다음 ${langName}로 된 간결한 한 문장 설명을 덧붙이십시오. 진술: "${transcript}"`, 
    keywords: { true: '사실', false: '거짓', uncertain: '불확실' } 
  },
  'pt-BR': { 
    title: 'Verificação de fatos em tempo real',
    subtitle: 'Suas palavras, capturadas e checadas instantaneamente.',
    selectLanguage: 'Selecionar Idioma',
    selectTranscriptionLanguage: 'Selecionar idioma da transcrição',
    transcriptPlaceholder: 'A transcrição aparecerá aqui...',
    statusListening: 'Ouvindo...',
    statusInitializing: 'Inicializando microfone...',
    statusReady: 'Pronto para ouvir',
    statusWaiting: 'Aguardando o final da declaração...',
    clearTranscript: 'Limpar transcrição',
    copyTranscript: 'Copiar transcrição',
    analysisHistory: 'Histórico de Análises',
    historyPlaceholder: 'Suas sessões verificadas aparecerão aqui.',
    analyzing: 'Analisando...',
    analysisFailed: 'Falha ao analisar a transcrição.',
    sources: 'Fontes',
    errorNotSupported: 'O reconhecimento de fala não é suportado neste navegador. Por favor, tente com o Chrome ou Edge.',
    errorMicNotAvailable: 'Microfone não disponível. Verifique as configurações do seu microfone.',
    errorMicAccessDenied: 'Acesso ao microfone negado. Por favor, permita nas configurações do seu navegador.',
    prompt: (transcript, langName) => `Analise a seguinte afirmação quanto à sua precisão factual. Comece sua resposta com uma das três palabras: 'Verdadeiro', 'Falso' ou 'Incerto', seguida por dois pontos e, em seguida, uma breve explicação de uma frase em ${langName}. Afirmação: "${transcript}"`, 
    keywords: { true: 'Verdadeiro', false: 'Falso', uncertain: 'Incerto' } 
  },
  'ru-RU': { 
    title: 'Проверка фактов в реальном времени',
    subtitle: 'Ваши слова, мгновенно записанные и проверенные.',
    selectLanguage: 'Выберите язык',
    selectTranscriptionLanguage: 'Выберите язык транскрипции',
    transcriptPlaceholder: 'Транскрипция появится здесь...',
    statusListening: 'Слушаю...',
    statusInitializing: 'Инициализация микрофона...',
    statusReady: 'Готов к прослушиванию',
    statusWaiting: 'Ожидание окончания высказывания...',
    clearTranscript: 'Очистить транскрипцию',
    copyTranscript: 'Копировать транскрипцию',
    analysisHistory: 'История анализов',
    historyPlaceholder: 'Ваши проверенные сессии появятся здесь.',
    analyzing: 'Анализ...',
    analysisFailed: 'Не удалось проанализировать транскрипцию.',
    sources: 'Источники',
    errorNotSupported: 'Распознавание речи не поддерживается в этом браузере. Пожалуйста, попробуйте Chrome или Edge.',
    errorMicNotAvailable: 'Микрофон недоступен. Проверьте настройки микрофона.',
    errorMicAccessDenied: 'Доступ к микрофону запрещен. Пожалуйста, разрешите его в настройках вашего браузера.',
    prompt: (transcript, langName) => `Проанализируйте следующее утверждение на предмет фактической точности. Начните свой ответ с одного из трех слов: 'Правда', 'Ложь' или 'Неопределенно', за которым следует двоеточие, а затем краткое объяснение в одном предложении на ${langName}. Утверждение: "${transcript}"`, 
    keywords: { true: 'Правда', false: 'Ложь', uncertain: 'Неопределенно' } 
  },
  'zh-CN': { 
    title: '实时事实核查',
    subtitle: '您的话语，即时捕捉并进行事实核查。',
    selectLanguage: '选择语言',
    selectTranscriptionLanguage: '选择转录语言',
    transcriptPlaceholder: '转录内容将显示在此处...',
    statusListening: '正在聆听...',
    statusInitializing: '正在初始化麦克风...',
    statusReady: '准备聆听',
    statusWaiting: '正在等待语句结束...',
    clearTranscript: '清除转录',
    copyTranscript: '复制转录',
    analysisHistory: '分析历史',
    historyPlaceholder: '您经过事实核查的会话将显示在此处。',
    analyzing: '分析中...',
    analysisFailed: '转录分析失败。',
    sources: '来源',
    errorNotSupported: '此浏览器不支持语音识别。请尝试使用 Chrome 或 Edge。',
    errorMicNotAvailable: '麦克风不可用。请检查您的麦克风设置。',
    errorMicAccessDenied: '麦克风访问被拒绝。请在您的浏览器设置中允许访问。',
    prompt: (transcript, langName) => `分析以下陈述的事实准确性。您的回答应以“真实”、“虚假”或“不确定”三个词中的一个开头，后跟一个冒号，然后是${langName}的简短单句解释。陈述：“${transcript}”`, 
    keywords: { true: '真实', false: '虚假', uncertain: '不确定' } 
  },
  'hi-IN': { 
    title: 'वास्तविक समय तथ्य-जांच',
    subtitle: 'आपके शब्द, तुरंत कैप्चर और तथ्य-जांच किए गए।',
    selectLanguage: 'भाषा चुनें',
    selectTranscriptionLanguage: 'ट्रांसक्रिप्शन भाषा चुनें',
    transcriptPlaceholder: 'ट्रांसक्रिप्ट यहाँ दिखाई देगी...',
    statusListening: 'सुन रहा है...',
    statusInitializing: 'माइक्रोफ़ोन प्रारंभ हो रहा है...',
    statusReady: 'सुनने के लिए तैयार',
    statusWaiting: 'कथन समाप्त होने की प्रतीक्षा में...',
    clearTranscript: 'ट्रांसक्रिप्ट साफ़ करें',
    copyTranscript: 'ट्रांसक्रिप्ट कॉपी करें',
    analysisHistory: 'विश्लेषण इतिहास',
    historyPlaceholder: 'आपके तथ्य-जांच किए गए सत्र यहां दिखाई देंगे।',
    analyzing: 'विश्लेषण हो रहा है...',
    analysisFailed: 'ट्रांसक्रिप्ट का विश्लेषण करने में विफल।',
    sources: 'स्रोत',
    errorNotSupported: 'इस ब्राउज़र में वाक् पहचान समर्थित नहीं है। कृपया क्रोम या एज का प्रयास करें।',
    errorMicNotAvailable: 'माइक्रोफ़ोन उपलब्ध नहीं है। अपनी माइक्रोफ़ोन सेटिंग जांचें।',
    errorMicAccessDenied: 'माइक्रोफ़ोन एक्सेस अस्वीकृत। कृपया इसे अपनी ब्राउज़र सेटिंग में अनुमति दें।',
    prompt: (transcript, langName) => `निम्नलिखित कथन की तथ्यात्मक सटीकता का विश्लेषण करें। अपनी प्रतिक्रिया 'सत्य', 'असत्य', या 'अनिश्चित' इन तीन शब्दों में से किसी एक से शुरू करें, उसके बाद एक कोलन और फिर ${langName} में एक संक्षिप्त, एक-वाक्य स्पष्टीकरण दें। कथन: "${transcript}"`, 
    keywords: { true: 'सत्य', false: 'असत्य', uncertain: 'अनिश्चित' } 
  },
};

// --- Supported Languages ---
const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' }, { code: 'es-ES', name: 'Español (España)' }, { code: 'fr-FR', name: 'Français' }, { code: 'de-DE', name: 'Deutsch' }, { code: 'it-IT', name: 'Italiano' }, { code: 'ja-JP', name: '日本語' }, { code: 'ko-KR', name: '한국어' }, { code: 'pt-BR', name: 'Português (Brasil)' }, { code: 'ru-RU', name: 'Русский' }, { code: 'zh-CN', name: '中文 (普通话)' }, { code: 'hi-IN', name: 'हिन्दी' },
];

const CONFIDENCE_THRESHOLD = 0.5;
type Status = 'idle' | 'listening' | 'error' | 'initializing' | 'waiting_for_end';

// --- Main App Component ---
export default function App() {
  const [status, setStatus] = useState<Status>('initializing');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  const errorRef = useRef(error);
  useEffect(() => { errorRef.current = error; }, [error]);

  const t = translations[language] || translations['en-US'];

  const analyzeTranscript = useCallback(async (sessionId: number, transcriptToAnalyze: string) => {
    try {
      const selectedLanguageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
      const prompt = t.prompt(transcriptToAnalyze, selectedLanguageName);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        },
      });
      
      const responseText = response.text;
      const { true: trueKeyword, false: falseKeyword, uncertain: uncertainKeyword } = t.keywords;
      const regex = new RegExp(`^(${trueKeyword}|${falseKeyword}|${uncertainKeyword}):`, 'i');
      const accuracyMatch = responseText.match(regex);
      
      let analysis: Session['analysis'];

      if (accuracyMatch) {
        const matchedKeyword = accuracyMatch[1].toLowerCase();
        let accuracy: Session['analysis']['accuracy'] = 'Uncertain';
        if (matchedKeyword === trueKeyword.toLowerCase()) accuracy = 'True';
        else if (matchedKeyword === falseKeyword.toLowerCase()) accuracy = 'False';

        const explanation = responseText.substring(accuracyMatch[0].length).trim();
        analysis = { accuracy, explanation };
      } else {
        analysis = { accuracy: 'Uncertain', explanation: responseText };
      }
      
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web)
        .filter((web: any) => web?.uri && web?.title) || [];

      analysis.sources = sources;
      
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'completed', analysis } : s));
    } catch (err) {
      console.error("Error analyzing transcript:", err);
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'error', error: t.analysisFailed } : s));
    }
  }, [language, t]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(t.errorNotSupported);
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
        if (recognitionRef.current) {
          recognitionRef.current?.start();
        }
    };
    
    recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        
        setError(event.error === 'audio-capture' 
          ? t.errorMicNotAvailable
          : t.errorMicAccessDenied
        );
        setStatus('error');
    };
    
    recognition.onspeechstart = () => {
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
    };

    recognition.onspeechend = () => {
        setIsSpeaking(false);
    };

    recognition.onresult = (event: any) => {
        if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
            stopTimerRef.current = null;
        }
        setIsSpeaking(true);
        setStatus('listening');
        
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
            const result = event.results[i];
            if (result.isFinal) {
                if (result[0].confidence > CONFIDENCE_THRESHOLD) {
                    finalTranscript += result[0].transcript;
                }
            } else {
                interimTranscript += result[0].transcript;
            }
        }
        const currentTranscript = finalTranscript + interimTranscript;
        setTranscript(currentTranscript);
        
        const isLastResultFinal = event.results[event.results.length - 1].isFinal;
        if (isLastResultFinal) {
            setStatus('waiting_for_end');
            stopTimerRef.current = window.setTimeout(() => {
                const finalTranscriptText = currentTranscript.trim();
                if (finalTranscriptText) {
                    const newSessionId = Date.now();
                    const newSession: Session = { id: newSessionId, transcript: finalTranscriptText, status: 'pending' };
                    setSessions(prev => [newSession, ...prev]);
                    analyzeTranscript(newSessionId, finalTranscriptText);
                }
                setTranscript('');
                recognitionRef.current?.stop();
            }, 1500);
        }
    };

    recognition.start();

    return () => {
      recognitionRef.current = null; 
      recognition.onend = null;
      recognition.stop();
    };
  }, [language, analyzeTranscript, t]);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript]);

  const StatusIndicator = () => {
    if (status === 'error') return <div className="text-red-400 font-medium text-center">{error}</div>;
    if (status === 'listening') {
        return (
          <div className="text-cyan-400 font-medium text-center flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span></span>
            {t.statusListening}
          </div>
        );
    }
    if (status === 'waiting_for_end') {
        return (
            <div className="text-slate-400 font-medium text-center flex items-center justify-center gap-2">
                <EllipsisIcon className="w-6 h-6 animate-pulse" />
                {t.statusWaiting}
            </div>
        );
    }
    if (status === 'initializing') return <div className="text-slate-400 font-medium text-center">{t.statusInitializing}</div>;
    return <div className="text-slate-400 font-medium text-center flex items-center justify-center gap-2"><MicrophoneIcon className="w-5 h-5" /> {t.statusReady}</div>;
  };
  
  const AnalysisResult = ({ session }: { session: Session }) => {
    switch (session.status) {
        case 'pending': return <div className="flex items-center gap-2 text-slate-400"><SpinnerIcon className="w-5 h-5 animate-spin" /><span>{t.analyzing}</span></div>;
        case 'error': return <div className="text-red-400">{session.error || t.analysisFailed}</div>;
        case 'completed':
            const accuracy = session.analysis?.accuracy.toLowerCase() ?? '';
            const color = accuracy === 'true' ? 'text-green-400' : accuracy === 'false' ? 'text-red-400' : 'text-yellow-400';
            const Icon = accuracy === 'true' ? CheckCircleIcon : accuracy === 'false' ? XCircleIcon : QuestionMarkCircleIcon;
            const displayedAccuracy = t.keywords[accuracy as keyof Translation['keywords']] || session.analysis?.accuracy;
            return (
                <div className="space-y-2">
                    <div className={`flex items-center gap-2 font-semibold ${color}`}>
                        <Icon className="w-6 h-6" />
                        <span className="uppercase">{displayedAccuracy}</span>
                    </div>
                    <p className="text-slate-400">{session.analysis?.explanation}</p>
                    {session.analysis?.sources && session.analysis.sources.length > 0 && (
                      <div className="pt-3">
                        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                          <LinkIcon className="w-4 h-4" />
                          {t.sources}
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
      <div className="w-full max-w-7xl mx-auto flex flex-col h-[90vh]">
        <header className="text-center mb-6 flex-shrink-0">
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">{t.title}</h1>
          <p className="text-slate-400 mt-2 text-lg">{t.subtitle}</p>
          <div className="mt-6 max-w-xs mx-auto">
            <label htmlFor="language-select" className="sr-only">{t.selectLanguage}</label>
            <select
                id="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                aria-label={t.selectTranscriptionLanguage}
                disabled={status === 'listening'}
            >
                {LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
            </select>
          </div>
        </header>

        <div className="flex-shrink-0 text-center mb-6 h-6"><StatusIndicator /></div>
        
        <main className="flex-grow flex flex-col md:flex-row gap-6 min-h-0">
          {/* Left Panel: Transcript */}
          <div className="w-full md:w-1/2 flex flex-col min-h-0">
              <div ref={transcriptContainerRef} className={`flex-grow bg-slate-800/50 rounded-lg shadow-inner p-6 overflow-y-auto transition-all duration-300 ${isSpeaking ? 'ring-2 ring-cyan-500' : 'ring-1 ring-slate-700/50'} ${!transcript ? 'flex items-center justify-center' : ''}`}>
                <p className="text-lg sm:text-xl leading-relaxed whitespace-pre-wrap">
                  {transcript || <span className="text-slate-500">{t.transcriptPlaceholder}</span>}
                </p>
              </div>
          </div>
          
          {/* Right Panel: History */}
          <div className="w-full md:w-1/2 flex flex-col min-h-0">
              <div className="flex-grow bg-slate-800/50 rounded-lg p-4 space-y-4 overflow-y-auto ring-1 ring-slate-700/50">
                  {sessions.length === 0 ? (
                      <div className="text-center text-slate-500 h-full flex items-center justify-center">{t.historyPlaceholder}</div>
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
        </main>
      </div>
    </div>
  );
}
