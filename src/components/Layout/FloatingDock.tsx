import { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Clipboard, Mic, Search, Palette, Sparkles, Square } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import { getGeminiKey } from '../../utils/geminiKeyStore';
import { GeminiKeyModal } from './GeminiKeyModal';
import { v4 as uuidv4 } from 'uuid';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { extractColorsFromUrl } from '../../utils/colorExtraction';
import { getAudioDuration } from '../../utils/audio';

export const FloatingDock = () => {
    const { backgroundColor, setBackgroundColor, cards, addCard, transform, searchQuery, setSearchQuery } = useBoardStore();
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [hasKey, setHasKey] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();

    useEffect(() => {
        setHasKey(!!getGeminiKey());
    }, [aiModalOpen]); // re-check after modal closes

    // Count matching cards for search badge
    const matchCount = searchQuery.trim()
        ? cards.filter(c => {
            const q = searchQuery.toLowerCase();
            return c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
        }).length
        : 0;

    // ---- Helpers ----

    /** Get the canvas coordinates at the center of the current viewport */
    const getViewportCenter = () => {
        const vx = window.innerWidth / 2;
        const vy = window.innerHeight / 2;
        const canvasX = (vx - transform.x) / transform.scale;
        const canvasY = (vy - transform.y) / transform.scale;
        return { canvasX, canvasY };
    };

    // ---- Handlers ----

    /** Search: update store query */
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            setSearchQuery('');
            (e.target as HTMLInputElement).blur();
        }
    };

    /** New Board: add a blank card at the viewport center */
    const handleNewCard = () => {
        const { canvasX, canvasY } = getViewportCenter();
        // Stagger successive cards so repeated adds don't stack perfectly on top of each other.
        const offset = (cards.length % 6) * 28;
        addCard({
            id: uuidv4(),
            x: canvasX - 150 + offset,
            y: canvasY - 200 + offset,
            width: 300,
            height: 400,
            title: 'New Card',
            description: 'Add a description...',
            mediaUrl: '',
            voiceMemos: [],
            tags: [],
            colors: [],
        });
    };

    /** Upload: trigger hidden file input */
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const { canvasX, canvasY } = getViewportCenter();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                const url = URL.createObjectURL(file);
                const isVideo = file.type.startsWith('video/');

                let colors: string[] = [];
                if (!isVideo) {
                    try {
                        colors = await extractColorsFromUrl(url);
                    } catch (error) {
                        console.error("Failed to extract colors from uploaded file", error);
                    }
                }

                addCard({
                    id: uuidv4(),
                    x: canvasX - 150 + i * 20,
                    y: canvasY - 200 + i * 20,
                    width: 300,
                    height: 400,
                    title: isVideo ? file.name : file.name,
                    description: '',
                    mediaUrl: url,
                    mediaType: isVideo ? 'video' : 'image',
                    voiceMemos: [],
                    tags: [],
                    colors,
                });
            }
        }

        // Reset file input so re-selecting the same file works
        e.target.value = '';
    };

    /** Paste: read clipboard images */
    const handlePaste = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            const { canvasX, canvasY } = getViewportCenter();

            for (const item of clipboardItems) {
                // Find an image type
                const imageType = item.types.find(t => t.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const url = URL.createObjectURL(blob);

                    let colors: string[] = [];
                    try {
                        colors = await extractColorsFromUrl(url);
                    } catch (error) {
                        console.error("Failed to extract colors from pasted image", error);
                    }

                    addCard({
                        id: uuidv4(),
                        x: canvasX - 150 + (Math.random() - 0.5) * 40,
                        y: canvasY - 200 + (Math.random() - 0.5) * 40,
                        width: 300,
                        height: 400,
                        title: 'Pasted Image',
                        description: '',
                        mediaUrl: url,
                        mediaType: 'image',
                        voiceMemos: [],
                        tags: [],
                        colors,
                    });
                }
            }
        } catch (err) {
            // Clipboard API may not be available or user denied permission
            console.warn('Clipboard read failed, trying execCommand fallback', err);
            // Trigger a standard paste event as a fallback
            document.execCommand('paste');
        }
    };

    /** Mic: global voice recording → creates a new card */
    const handleMicToggle = async () => {
        if (isRecording) {
            const blob = await stopRecording();
            const audioUrl = URL.createObjectURL(blob);
            const duration = await getAudioDuration(audioUrl);
            const { canvasX, canvasY } = getViewportCenter();

            addCard({
                id: uuidv4(),
                x: canvasX - 150,
                y: canvasY - 200,
                width: 300,
                height: 400,
                title: 'Voice Note',
                description: '',
                mediaUrl: '',
                voiceMemos: [{
                    id: uuidv4(),
                    url: audioUrl,
                    duration,
                    timestamp: Date.now(),
                }],
                tags: [],
                colors: [],
            });
        } else {
            await startRecording();
        }
    };

    return (
        <>
            {/* Hidden file input for Upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
            />

            <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 p-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg z-50">
                {/* App Title */}
                <div className="px-3 border-r border-foreground/10">
                    <img src={`${import.meta.env.BASE_URL}stash-logo.png`} alt="Stash" className="h-6" />
                </div>

                {/* Search */}
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search cards..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onKeyDown={handleSearchKeyDown}
                        className="pl-9 pr-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-48 transition-all placeholder:text-muted-foreground/70"
                    />
                    {/* Match count badge */}
                    {searchQuery.trim() && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-bold bg-[#ccff00] text-black shadow-md">
                            {matchCount}
                        </span>
                    )}
                </div>

                {/* Divider */}
                <div className="w-px h-6 bg-foreground/10" />

                {/* Actions */}
                <div className="flex items-center gap-1 pr-2">
                    <button
                        onClick={handleNewCard}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors text-foreground/70 hover:text-foreground"
                        title="Add New Card"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleUploadClick}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors text-foreground/70 hover:text-foreground"
                        title="Upload Image or Video"
                    >
                        <Upload className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handlePaste}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors text-foreground/70 hover:text-foreground"
                        title="Paste from Clipboard"
                    >
                        <Clipboard className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleMicToggle}
                        className={`p-2 rounded-full transition-colors ${
                            isRecording
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'hover:bg-red-50 text-red-500/80 hover:text-red-500'
                        }`}
                        title={isRecording ? 'Stop Recording & Create Card' : 'Record Voice Memo'}
                    >
                        {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                    </button>

                    {/* Divider */}
                    <div className="w-px h-6 bg-foreground/10 mx-1" />

                    {/* AI Font Extraction Button */}
                    <button
                        onClick={() => setAiModalOpen(true)}
                        className="relative p-2 rounded-full transition-all hover:scale-105"
                        style={{
                            background: hasKey
                                ? 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(99,102,241,0.25))'
                                : 'rgba(255,255,255,0.05)',
                        }}
                        title="AI Font Extraction"
                    >
                        <Sparkles className={`w-5 h-5 ${hasKey ? 'text-purple-400' : 'text-foreground/50'}`} />
                        {hasKey && (
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ccff00] shadow-[0_0_6px_rgba(204,255,0,0.8)]" />
                        )}
                    </button>

                    {/* Divider */}
                    <div className="w-px h-6 bg-foreground/10 mx-1" />

                    {/* Background Color Picker */}
                    <div className="flex items-center gap-2 px-2">
                        <Palette className="w-4 h-4 text-foreground/70" />
                        <input
                            type="color"
                            value={backgroundColor}
                            onChange={(e) => setBackgroundColor(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                            title="Change Background Color"
                        />
                    </div>
                </div>
            </div>

            <GeminiKeyModal open={aiModalOpen} onClose={() => setAiModalOpen(false)} />
        </>
    );
};
