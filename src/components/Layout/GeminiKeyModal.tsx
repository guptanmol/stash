import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, CheckCircle, XCircle, Loader2, Sparkles, Eye, EyeOff, ExternalLink, FlaskConical } from 'lucide-react';
import { getGeminiKey, setGeminiKey, clearGeminiKey } from '../../utils/geminiKeyStore';
import { autodiscoverModel } from '../../utils/fontExtraction';

interface GeminiKeyModalProps {
    open: boolean;
    onClose: () => void;
}

type Status = 'idle' | 'testing' | 'valid' | 'invalid';

/** Draw "Hello Inter" text on a canvas and return it as base64 PNG */
function makeTestImageBase64(): { base64: string; mimeType: string } {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 48px Arial, Helvetica, sans-serif';
    ctx.fillText('Hello Inter', 20, 75);
    ctx.font = '24px Georgia, serif';
    ctx.fillStyle = '#555555';
    ctx.fillText('Playfair Display', 20, 108);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    return { base64, mimeType: 'image/png' };
}

export const GeminiKeyModal = ({ open, onClose }: GeminiKeyModalProps) => {
    const [key, setKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [status, setStatus] = useState<Status>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testRunning, setTestRunning] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            const saved = getGeminiKey();
            if (saved) {
                setKey(saved.key);
                setStatus('valid');
            } else {
                setKey('');
                setStatus('idle');
            }
            setTestResult(null);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const handleSaveAndTest = async () => {
        if (!key.trim()) return;
        setStatus('testing');
        setErrorMsg('');
        setTestResult(null);
        const res = await autodiscoverModel(key.trim());
        if (res.ok && res.modelId) {
            setGeminiKey(key.trim(), res.modelId);
            setStatus('valid');
        } else {
            setStatus('invalid');
            setErrorMsg(res.error || 'Key validation failed. Check that the key is correct and the Gemini API is enabled.');
        }
    };

    const handleClear = () => {
        clearGeminiKey();
        setKey('');
        setStatus('idle');
        setErrorMsg('');
        setTestResult(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSaveAndTest();
        if (e.key === 'Escape') onClose();
    };

    /** Send a synthetic text image and show the raw Gemini response */
    const handleRunVisionTest = async () => {
        const gemini = getGeminiKey();
        if (!gemini) return;
        setTestRunning(true);
        setTestResult(null);
        try {
            const { base64, mimeType } = makeTestImageBase64();
            const url = `https://generativelanguage.googleapis.com/v1beta/${gemini.modelId}:generateContent?key=${gemini.key}`;
            const body = {
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: base64 } },
                        { text: 'List every font name you can see in this image. Reply with ONLY a JSON array of strings.' },
                    ]
                }],
                // Mirror the real font-extraction config so this is a faithful test.
                generationConfig: { temperature: 0, maxOutputTokens: 2048, responseMimeType: 'application/json' },
            };
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
                setTestResult(`❌ API error ${resp.status}: ${data?.error?.message || JSON.stringify(data)}`);
            } else {
                const candidate = data?.candidates?.[0];
                const text = candidate?.content?.parts?.[0]?.text;
                const reason = candidate?.finishReason;
                if (text) {
                    setTestResult(`✅ Model (${gemini.modelId}) responded:\n\n${text}`);
                } else {
                    setTestResult(`⚠️ No text in response. finishReason=${reason}\n\nFull: ${JSON.stringify(data, null, 2)}`);
                }
            }
        } catch (e: any) {
            setTestResult(`❌ Network error: ${e.message}`);
        } finally {
            setTestRunning(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[200] flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        className="relative w-full max-w-md mx-4 rounded-3xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
                            backdropFilter: 'blur(40px)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            boxShadow: '0 32px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06) inset',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                        }}
                        initial={{ scale: 0.9, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.9, y: 20, opacity: 0 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                    >
                        {/* Header gradient strip */}
                        <div className="h-1 w-full" style={{
                            background: 'linear-gradient(90deg, #a855f7, #6366f1, #ccff00)'
                        }} />

                        <div className="p-7">
                            {/* Close */}
                            <button
                                onClick={onClose}
                                className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            {/* Title */}
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-xl" style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-white font-semibold text-lg leading-tight">AI Font Extraction</h2>
                                    <p className="text-white/40 text-xs">Powered by Gemini Vision</p>
                                </div>
                            </div>

                            <p className="text-white/60 text-sm mb-6 leading-relaxed">
                                Font detection is <span className="text-white/80">optional</span>. Add a Gemini API key
                                — Google AI Studio's free tier is <span className="text-white/80">$0</span> — and every image
                                you add will have its typefaces identified and linked to Google Fonts. Everything else
                                (colors, notes, voice) works without it.
                            </p>

                            {/* Get key link */}
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors mb-4"
                                onClick={e => e.stopPropagation()}
                            >
                                <ExternalLink className="w-3 h-3" />
                                Get a free API key from Google AI Studio
                            </a>

                            {/* Input */}
                            <div className="relative mb-3">
                                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                <input
                                    ref={inputRef}
                                    type={showKey ? 'text' : 'password'}
                                    value={key}
                                    onChange={e => { setKey(e.target.value); setStatus('idle'); setErrorMsg(''); setTestResult(null); }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="AIza..."
                                    className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none transition-all"
                                    style={{
                                        background: 'rgba(255,255,255,0.06)',
                                        border: status === 'valid' ? '1px solid rgba(204,255,0,0.4)' : status === 'invalid' ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                                >
                                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Status message */}
                            <AnimatePresence mode="wait">
                                {status === 'valid' && (
                                    <motion.div
                                        key="valid"
                                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="flex items-center gap-2 text-[#ccff00] text-xs mb-4"
                                    >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Key saved — using {getGeminiKey()?.modelId?.replace('models/', '')}
                                    </motion.div>
                                )}
                                {status === 'invalid' && (
                                    <motion.div
                                        key="invalid"
                                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="flex items-center gap-2 text-red-400 text-xs mb-4"
                                    >
                                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errorMsg}</span>
                                    </motion.div>
                                )}
                                {(status === 'idle' || status === 'testing') && <div key="spacer" className="mb-4" />}
                            </AnimatePresence>

                            {/* Actions */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={handleSaveAndTest}
                                    disabled={!key.trim() || status === 'testing'}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{
                                        background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                                        color: 'white',
                                    }}
                                >
                                    {status === 'testing' ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</>
                                    ) : (
                                        <><Sparkles className="w-4 h-4" /> Save &amp; Test</>
                                    )}
                                </button>

                                {status === 'valid' && (
                                    <button
                                        onClick={handleClear}
                                        className="px-4 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>

                            {/* Vision Diagnostic Test — only shown when key is saved */}
                            {status === 'valid' && (
                                <div
                                    className="rounded-2xl p-4"
                                    style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
                                            <span className="text-xs font-mono text-purple-400 uppercase tracking-widest">Vision Diagnostic</span>
                                        </div>
                                        <button
                                            onClick={handleRunVisionTest}
                                            disabled={testRunning}
                                            className="text-xs px-3 py-1 rounded-full transition-all disabled:opacity-40"
                                            style={{ background: 'rgba(168,85,247,0.2)', color: '#c4b5fd' }}
                                        >
                                            {testRunning ? 'Running…' : 'Run Test'}
                                        </button>
                                    </div>
                                    <p className="text-white/30 text-[11px] mb-3">
                                        Sends a synthetic image with "Hello Inter" text to Gemini and shows the exact raw response below.
                                    </p>
                                    {testResult && (
                                        <pre
                                            className="text-[11px] text-white/70 whitespace-pre-wrap break-all rounded-xl p-3"
                                            style={{ background: 'rgba(0,0,0,0.3)', maxHeight: 200, overflowY: 'auto' }}
                                        >
                                            {testResult}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
