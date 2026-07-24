import { useRef, useState, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Play, ExternalLink, Square, Pause, X, Sparkles, Type, RefreshCw, Link2, Pencil, Check, Upload, Plus } from 'lucide-react';
import type { CardData } from '../../types';
import { useBoardStore } from '../../store/boardStore';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { v4 as uuidv4 } from 'uuid';
import { clsx } from 'clsx';
import { extractFontsFromVideoFrame, extractFontsFromImageUrl } from '../../utils/fontExtraction';
import { getGeminiKey } from '../../utils/geminiKeyStore';
import { extractColorsFromUrl } from '../../utils/colorExtraction';
import { getAudioDuration, formatDuration } from '../../utils/audio';
import { getMedia, activeIndex } from '../../utils/media';
import { MediaCarousel } from './MediaCarousel';

interface GlassCardProps {
  data: CardData;
}

export const GlassCard = ({ data }: GlassCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { updateCard, selectCard, removeCard, selectedCardIds, transform, searchQuery, addMediaToCard, setActiveMedia, updateMediaItem } = useBoardStore();
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isSelected = selectedCardIds.includes(data.id);
  const scale = transform.scale;

  // Media (supports multiple images/videos per card; the active one is shown).
  const media = getMedia(data);
  const idx = activeIndex(data);
  const active = media[idx] || null;
  const addFileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      const url = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      let colors: string[] = [];
      if (!isVideo) {
        try { colors = await extractColorsFromUrl(url); } catch (e) { console.error('color extract failed', e); }
      }
      addMediaToCard(data.id, { id: uuidv4(), url, type: isVideo ? 'video' : 'image', colors });
    }
  };

  // Search match logic
  const isSearchActive = searchQuery.trim().length > 0;
  const isSearchMatch = isSearchActive && (
    data.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    data.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const [extractingFonts, setExtractingFonts] = useState(false);
  const [extractingColors, setExtractingColors] = useState(false);

  // Source-link editing
  const [editingLink, setEditingLink] = useState(false);
  const [linkValue, setLinkValue] = useState(data.link || '');

  const saveLink = () => {
    const v = linkValue.trim();
    const normalized = v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : undefined;
    updateCard(data.id, { link: normalized });
    setEditingLink(false);
  };

  // Resize the image (and therefore the whole card) via the bottom-right handle.
  const resizeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = resizeRef.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      // Native stopPropagation prevents the card's move-gesture from starting.
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = data.width || 300;
      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / (transform.scale || 1);
        const newWidth = Math.max(220, Math.min(900, startWidth + dx));
        updateCard(data.id, { width: newWidth });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, [data.id, data.width, transform.scale, updateCard]);

  // Manually reset and re-trigger font extraction (on the active image).
  const handleRetryFonts = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (extractingFonts || !active) return;
    // Setting fonts to undefined causes the effect to re-run extraction
    updateMediaItem(data.id, active.id, { fonts: undefined });
  };

  // Re-extract colors from the active image
  const handleRetryColors = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (extractingColors || !active || active.type === 'video') return;
    setExtractingColors(true);
    try {
      const colors = await extractColorsFromUrl(active.url);
      updateMediaItem(data.id, active.id, { colors });
    } catch (err) {
      console.error('Color re-extraction failed', err);
    } finally {
      setExtractingColors(false);
    }
  };

  useGesture({
    onDrag: ({ movement: [dx, dy], first, last, memo, event }) => {
      // Ignore drags that begin on the resize handle — those resize, not move.
      if (first && (event.target as HTMLElement)?.closest?.('[data-resize-handle]')) {
        return { skip: true };
      }
      if (memo?.skip) return memo;

      let [initialX, initialY] = memo || [data.x, data.y];

      if (first) {
        initialX = data.x;
        initialY = data.y;
      }

      const newX = initialX + dx / scale;
      const newY = initialY + dy / scale;

      updateCard(data.id, {
        x: newX,
        y: newY
      });

      if (last) {
        // Check if dropped inside a section
        const sections = useBoardStore.getState().sections;
        const cardCenterX = newX + data.width / 2;
        const cardCenterY = newY + data.height / 2;

        const targetSection = sections.find(section =>
          cardCenterX >= section.x &&
          cardCenterX <= section.x + section.width &&
          cardCenterY >= section.y &&
          cardCenterY <= section.y + section.height
        );

        if (targetSection) {
          if (data.sectionId !== targetSection.id) {
            updateCard(data.id, { sectionId: targetSection.id });
          }
        } else {
          if (data.sectionId) {
            updateCard(data.id, { sectionId: undefined });
          }
        }
      }

      return [initialX, initialY];
    },
  }, {
    target: ref,
  });

  const handleRecordToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRecording) {
      const blob = await stopRecording();
      const url = URL.createObjectURL(blob);
      const duration = await getAudioDuration(url);
      const newMemo = {
        id: uuidv4(),
        url,
        duration,
        timestamp: Date.now()
      };
      updateCard(data.id, { voiceMemos: [...data.voiceMemos, newMemo] });
    } else {
      await startRecording();
    }
  };

  const handlePlayMemo = (e: React.MouseEvent, url: string, id: string) => {
    e.stopPropagation();
    if (!url) return; // Nothing to play (e.g. a memo with no recorded audio)
    if (playingMemoId === id) {
      audioRef.current?.pause();
      setPlayingMemoId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingMemoId(null);
      audio.play();
      setPlayingMemoId(id);
    }
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.description);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Extract fonts from the active video's first frame
  useEffect(() => {
    if (!active || active.type !== 'video' || active.fonts !== undefined) return;
    const video = videoRef.current;
    if (!video) return;

    let done = false;
    const tryExtract = async () => {
      if (done) return;
      done = true;
      const gemini = getGeminiKey();
      if (!gemini) return;
      setExtractingFonts(true);
      try {
        const fonts = await extractFontsFromVideoFrame(video, gemini.key, gemini.modelId);
        updateMediaItem(data.id, active.id, { fonts });
      } finally {
        setExtractingFonts(false);
      }
    };

    const onLoaded = () => { if (video.readyState >= 2) tryExtract(); };
    if (video.readyState >= 2) {
      tryExtract();
    } else {
      video.addEventListener('loadeddata', onLoaded);
      return () => video.removeEventListener('loadeddata', onLoaded);
    }
  }, [active?.id, active?.type, active?.fonts, data.id, updateMediaItem]);

  // Extract fonts for the active image if it hasn't been done yet
  useEffect(() => {
    if (!active || active.type === 'video' || active.fonts !== undefined || !active.url) {
      setExtractingFonts(false);
      return;
    }

    const tryExtractImageFonts = async () => {
      const gemini = getGeminiKey();
      if (!gemini) {
        setExtractingFonts(false);
        return;
      }

      setExtractingFonts(true);
      try {
        const fonts = await extractFontsFromImageUrl(active.url, gemini.key, gemini.modelId);
        updateMediaItem(data.id, active.id, { fonts });
      } catch (e) {
        console.error("Font extraction failed", e);
        updateMediaItem(data.id, active.id, { fonts: [] }); // ensure we stop loading
      } finally {
        setExtractingFonts(false);
      }
    };

    tryExtractImageFonts();
  }, [active?.id, active?.url, active?.fonts, active?.type, data.id, updateMediaItem]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    updateCard(data.id, { description: editValue });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(data.description);
    }
  };

  return (
    <motion.div
      ref={ref}
      data-card-id={data.id}
      className={clsx(
        "absolute flex flex-col items-center group select-none pt-1 pb-1.5 px-1 rounded-[2rem]", // Top 4px (pt-1), Bottom 6px (pb-1.5), Horizontal 4px (px-1)
        "bg-black/30 backdrop-blur-md border border-white/[0.08]", // Subtle border keeps the card distinct from a same-colored background
        "h-fit", // Height hugs content; width is controlled by data.width (resizable)
        "cursor-grab active:cursor-grabbing",
        isSearchActive && !isSearchMatch && "pointer-events-auto"
      )}
      style={{
        left: 0,
        top: 0,
        width: data.width,
        transform: `translate3d(${data.x}px, ${data.y}px, 0)`,
        opacity: isSearchActive && !isSearchMatch ? 0.25 : 1,
        transition: 'opacity 0.3s ease, box-shadow 0.3s ease',
        // Soft shadow so cards read as lifted surfaces even on a near-black board
        boxShadow: isSearchMatch
          ? '0 0 0 3px #ccff00, 0 0 24px rgba(204,255,0,0.35)'
          : '0 12px 40px rgba(0,0,0,0.55)',
        borderRadius: '2rem',
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Select the card (shift-click adds to the current selection)
        selectCard(data.id, e.shiftKey);
      }}
    >
      {/* Floating Tags Container */}
      <div className="relative w-full flex justify-center items-center mb-6">
        {/* Central Image/Video (active item of the card's media) */}
        <div
          className={clsx(
            // Concentric with the card: inner r = outer 2rem − 0.25rem (px-1/pt-1) padding → 1.75rem (R = r + padding)
            "relative rounded-[1.75rem] overflow-hidden shadow-2xl transition-all duration-300",
            "w-full h-auto", // Hug content, keep aspect ratio; width follows the resizable card
            isSelected && data.color ? `ring-4 ring-transparent` : isSelected ? "ring-4 ring-[#ccff00]/50" : ""
          )}
          style={{
            ...(isSelected && data.color ? { boxShadow: `0 0 0 4px ${data.color}50` } : {})
          }}
          onMouseEnter={() => videoRef.current?.play()}
          onMouseLeave={() => videoRef.current?.pause()}
        >
          {/* Hidden input for adding media to this card */}
          <input
            ref={addFileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => { handleAddFiles(e.target.files); e.target.value = ''; }}
          />

          {active ? (
            active.type === 'video' ? (
              <video
                key={active.id}
                ref={videoRef}
                src={active.url}
                className="w-full h-auto object-contain pointer-events-none"
                loop
                muted
                playsInline
              />
            ) : (
              <img key={active.id} src={active.url} alt={data.title} className="w-full h-auto object-contain pointer-events-none" />
            )
          ) : (
            <div className="w-full h-[300px] bg-secondary/30 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <span className="text-sm">No media yet</span>
              <button
                onClick={(e) => { e.stopPropagation(); addFileInputRef.current?.click(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Upload image or video
              </button>
              <span className="text-[11px] text-white/30">or select the card and paste</span>
            </div>
          )}

          {/* Add-more button (top-left) */}
          {active && (
            <button
              onClick={(e) => { e.stopPropagation(); addFileInputRef.current?.click(); }}
              title="Add image or video"
              className="absolute top-2 left-2 z-20 p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/25 text-white/90 opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* Delete card (top-right, same inset/padding as the add button) */}
          <button
            onClick={(e) => { e.stopPropagation(); removeCard(data.id); }}
            title="Delete card"
            className="absolute top-2 right-2 z-20 p-2 rounded-full bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Resize handle — appears on hover; drag to resize the image (and the card with it) */}
          {active && (
            <div
              ref={resizeRef}
              data-resize-handle
              title="Drag to resize"
              className="absolute bottom-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity cursor-nwse-resize touch-none"
            >
              <div className="w-6 h-6 rounded-lg bg-black/50 backdrop-blur-md border border-white/25 flex items-center justify-center text-white/80 hover:bg-black/70 transition-colors">
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M9 3 L3 9 M9 6.5 L6.5 9" />
                </svg>
              </div>
            </div>
          )}

          {/* Carousel — Dock-style magnification; only when >1 media item. */}
          {media.length > 1 && (
            <MediaCarousel media={media} activeIndex={idx} onSelect={(i) => setActiveMedia(data.id, i)} />
          )}
        </div>

        {/* Floating Tags */}
        {data.tags?.map((tag) => (
          <motion.div
            key={tag.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm text-xs font-medium text-foreground/80 whitespace-nowrap pointer-events-none"
            style={{
              transform: `translate(${tag.x}px, ${tag.y}px)`
            }}
          >
            {tag.label}
          </motion.div>
        ))}
      </div>

      {/* Extracted Colors Palette */}
      {data.mediaUrl && data.mediaType !== 'video' && (
        <div className="w-full px-4 mb-2">
          {/* Header row */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Colors</span>
            <button
              onClick={handleRetryColors}
              disabled={extractingColors}
              className="ml-auto text-white/30 hover:text-white/70 transition-colors disabled:opacity-30"
              title="Re-extract colors"
            >
              {extractingColors
                ? <RefreshCw className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
            </button>
          </div>

          {extractingColors ? (
            /* Shimmer skeleton while re-extracting */
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-lg animate-pulse"
                  style={{
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.06) 100%)',
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          ) : data.colors && data.colors.length > 0 ? (
            <div className="flex justify-center gap-2">
              {data.colors.map((color, index) => (
                <div
                  key={index}
                  className="w-8 h-8 rounded-lg shadow-sm ring-1 ring-white/10 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                  style={{ backgroundColor: color }}
                  title={`Copy ${color}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(color);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-[11px] text-white/20 italic">No colors — click ↻ to extract</div>
          )}
        </div>
      )}

      {/* Extracted Fonts */}
      <AnimatePresence>
        {/* Always show the section if a Gemini key is configured (to show retry) */}
        {(extractingFonts || data.fonts !== undefined) && getGeminiKey() && data.mediaUrl && data.mediaType !== 'video' && (
          <motion.div
            className="w-full px-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header — show retry only when no fonts were found */}
            <div className="flex items-center gap-1.5 mb-2">
              <Type className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400/80">
                {data.fonts && data.fonts.length > 0 ? 'Fonts detected' : 'Fonts detected'}
              </span>
              {/* Show retry when nothing was found or extraction errored — successful results stay locked */}
              {(!data.fonts || data.fonts.length === 0 || data.fonts.some(f => f.category === 'error')) && (
                <button
                  onClick={handleRetryFonts}
                  disabled={extractingFonts}
                  className="ml-auto text-purple-400/50 hover:text-purple-400 transition-colors disabled:opacity-30"
                  title="Re-run font extraction"
                >
                  {extractingFonts
                    ? <Sparkles className="w-3 h-3 animate-pulse" />
                    : <span className="text-[11px]">↻</span>
                  }
                </button>
              )}
            </div>

            {extractingFonts && (!data.fonts || data.fonts.length === 0) ? (
              /* Shimmer skeleton */
              <div className="flex flex-wrap gap-2">
                {[80, 110, 95].map((w, i) => (
                  <div
                    key={i}
                    className="h-7 rounded-full animate-pulse"
                    style={{
                      width: w,
                      background: 'linear-gradient(90deg, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0.30) 50%, rgba(168,85,247,0.15) 100%)',
                      backgroundSize: '200% 100%',
                      animation: `shimmer 1.5s infinite ${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            ) : data.fonts && data.fonts.length === 0 && !extractingFonts ? (
              /* Empty state — ran successfully but no fonts found */
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-purple-400/40 italic">No fonts detected in this image.</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.fonts?.map((font, i) => (
                  <motion.a
                    key={i}
                    href={font.googleFontSlug ? `https://fonts.google.com/specimen/${encodeURIComponent(font.name.replace(/ /g, '+'))}` : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.85, y: 4 }}
                    animate={{
                      opacity: font.confidence === 'high' ? 1 : font.confidence === 'medium' ? 0.75 : 0.5,
                      scale: 1,
                      y: 0
                    }}
                    transition={{ delay: i * 0.07 }}
                    className={clsx(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
                      font.googleFontSlug ? "cursor-pointer hover:scale-105" : "cursor-default",
                      font.category === 'error' && "border-red-500/40 text-red-400"
                    )}
                    style={{
                      background: font.category === 'error'
                        ? 'rgba(239,68,68,0.15)'
                        : 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(99,102,241,0.2))',
                      border: `1px solid ${font.category === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(168,85,247,0.3)'}`,
                      color: font.category === 'error' ? '#f87171' : '#c4b5fd',
                    }}
                    title={`${font.name} · ${font.category} · ${font.confidence} confidence`}
                  >
                    <span>{font.name}</span>
                    {font.category !== 'error' && (
                      <span
                        className="text-[9px] uppercase tracking-wider rounded px-1 py-0.5"
                        style={{ background: 'rgba(168,85,247,0.2)', color: '#a78bfa' }}
                      >
                        {font.category}
                      </span>
                    )}
                    {font.googleFontSlug && <ExternalLink className="w-2.5 h-2.5 opacity-50" />}
                  </motion.a>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optional font detection prompt — only when no key is configured (image cards). */}
      {!getGeminiKey() && data.mediaUrl && data.mediaType !== 'video' && (
        <div className="w-full px-4 mb-3 flex justify-center">
          <button
            onClick={(e) => { e.stopPropagation(); (window as any).stashOpenAiKeyModal?.(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] text-purple-300/70 hover:text-purple-200 transition-colors"
            style={{ background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.25)' }}
            title="Optional — add a free Gemini key to detect fonts"
          >
            <Sparkles className="w-3 h-3" />
            <span>Detect fonts — optional, free</span>
          </button>
        </div>
      )}

      {/* Divider — separates image-derived data (above) from personal notes (below) */}
      {data.mediaUrl && data.mediaType !== 'video' && (
        <div className="w-full px-4 mb-3">
          <div className="h-px bg-white/[0.06]" />
        </div>
      )}

      {/* Notes — why I saved this, written and spoken together */}
      <div className="w-full px-2 text-center">
        <div className="text-sm font-bold text-[#ccff00] tracking-wide font-mono uppercase opacity-80 mb-2">
          Why did I save this:
        </div>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full bg-white/10 text-white rounded-lg p-2 text-base font-light focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 resize-none"
            rows={3}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p
            className="text-base text-white/90 leading-relaxed font-light cursor-text hover:bg-white/5 rounded px-2 py-1 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            {data.description || "Add a description..."}
          </p>
        )}

        {/* Voice notes — spoken rationale, grouped with the written note */}
        <div className="flex items-center justify-center gap-2 flex-wrap mt-3">
          <button
            onClick={handleRecordToggle}
            title={isRecording ? 'Stop recording' : 'Record a voice note'}
            className={clsx(
              "p-1.5 rounded-full transition-colors",
              isRecording ? "bg-red-500 text-white animate-pulse" : "bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white"
            )}
          >
            {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3 h-3" />}
          </button>

          {data.voiceMemos.map(memo => (
            <button
              key={memo.id}
              onClick={(e) => handlePlayMemo(e, memo.url, memo.id)}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors",
                playingMemoId === memo.id ? "bg-[#ccff00] text-black" : "bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white"
              )}
            >
              {playingMemoId === memo.id ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
              <span className="text-[10px] font-mono">{formatDuration(memo.duration)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Source — provenance (add / edit / open) */}
      <div className="w-full px-2 mt-4 pt-3 border-t border-white/[0.06] flex justify-center">
        {editingLink ? (
          <div
            className="flex items-center gap-1.5 w-full max-w-[280px]"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveLink();
                if (e.key === 'Escape') { setLinkValue(data.link || ''); setEditingLink(false); }
              }}
              placeholder="Paste a source URL…"
              className="flex-1 min-w-0 bg-white/10 text-white text-xs rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/40 placeholder:text-white/30"
            />
            <button
              onClick={saveLink}
              title="Save source"
              className="p-1.5 rounded-full bg-[#ccff00] text-black hover:brightness-110 transition"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : data.link ? (
          <div className="flex items-center gap-2">
            <a
              href={data.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs text-white hover:bg-white/20 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
              <span>Source</span>
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); setLinkValue(data.link || ''); setEditingLink(true); }}
              title="Edit source"
              className="p-1.5 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setLinkValue(''); setEditingLink(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-white/45 hover:text-white/80 hover:bg-white/10 transition-colors"
            title="Add a source link"
          >
            <Link2 className="w-3 h-3" />
            <span>Add source</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};
