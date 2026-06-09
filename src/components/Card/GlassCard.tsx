import { useRef, useState, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Play, ExternalLink, MoreHorizontal, Square, Pause, X, Sparkles, Type, RefreshCw, Ruler } from 'lucide-react';
import type { CardData } from '../../types';
import { useBoardStore } from '../../store/boardStore';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { v4 as uuidv4 } from 'uuid';
import { clsx } from 'clsx';
import { extractFontsFromVideoFrame, extractFontsFromImageUrl } from '../../utils/fontExtraction';
import { getGeminiKey } from '../../utils/geminiKeyStore';
import { extractColorsFromUrl } from '../../utils/colorExtraction';
import { extractDesignAnnotations } from '../../utils/designExtraction';

interface GlassCardProps {
  data: CardData;
}

export const GlassCard = ({ data }: GlassCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { updateCard, selectCard, removeCard, selectedCardIds, transform, searchQuery } = useBoardStore();
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isSelected = selectedCardIds.includes(data.id);
  const scale = transform.scale;

  // Search match logic
  const isSearchActive = searchQuery.trim().length > 0;
  const isSearchMatch = isSearchActive && (
    data.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    data.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const [extractingFonts, setExtractingFonts] = useState(false);
  const [extractingColors, setExtractingColors] = useState(false);
  const [extractingDNA, setExtractingDNA] = useState(false);

  // Manually reset and re-trigger font extraction
  const handleRetryFonts = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (extractingFonts) return;
    // Setting fonts to undefined causes the effect to re-run extraction
    updateCard(data.id, { fonts: undefined });
  };

  // Re-extract colors from the image
  const handleRetryColors = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (extractingColors || !data.mediaUrl || data.mediaType === 'video') return;
    setExtractingColors(true);
    try {
      const colors = await extractColorsFromUrl(data.mediaUrl);
      updateCard(data.id, { colors });
    } catch (err) {
      console.error('Color re-extraction failed', err);
    } finally {
      setExtractingColors(false);
    }
  };

  // Extract design annotations (manual only)
  const handleExtractDNA = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (extractingDNA || !data.mediaUrl || data.mediaType === 'video') return;
    
    const gemini = getGeminiKey();
    if (!gemini) {
      alert('Please set your Gemini API key first using the ✨ button.');
      return;
    }

    setExtractingDNA(true);
    try {
      const annotations = await extractDesignAnnotations(data.mediaUrl, gemini.key, gemini.modelId);
      updateCard(data.id, { designAnnotations: annotations });
    } catch (err) {
      console.error('Design DNA extraction failed', err);
    } finally {
      setExtractingDNA(false);
    }
  };

  useGesture({
    onDrag: ({ movement: [dx, dy], first, last, memo }) => {
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
      const newMemo = {
        id: uuidv4(),
        url,
        duration: 0, // We'd need to calculate this, but for now 0 or mock
        timestamp: Date.now()
      };
      updateCard(data.id, { voiceMemos: [...data.voiceMemos, newMemo] });
    } else {
      await startRecording();
    }
  };

  const handlePlayMemo = (e: React.MouseEvent, url: string, id: string) => {
    e.stopPropagation();
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
  const videoFontExtractedRef = useRef(false);

  // Extract fonts from video first frame
  useEffect(() => {
    if (data.mediaType !== 'video' || videoFontExtractedRef.current) return;
    if (data.fonts !== undefined) { videoFontExtractedRef.current = true; return; } // already extracted

    const video = videoRef.current;
    if (!video) return;

    const tryExtract = async () => {
      const gemini = getGeminiKey();
      if (!gemini) return;
      videoFontExtractedRef.current = true;
      setExtractingFonts(true);
      try {
        const fonts = await extractFontsFromVideoFrame(video, gemini.key, gemini.modelId);
        updateCard(data.id, { fonts });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.mediaType, data.id]);

  // Extract fonts for images if they haven't been extracted yet
  useEffect(() => {
    if (data.mediaType === 'video' || data.fonts !== undefined) {
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
        const fonts = await extractFontsFromImageUrl(data.mediaUrl, gemini.key, gemini.modelId);
        updateCard(data.id, { fonts });
      } catch (e) {
        console.error("Font extraction failed", e);
        updateCard(data.id, { fonts: [] }); // ensure we stop loading
      } finally {
        setExtractingFonts(false);
      }
    };

    tryExtractImageFonts();
  }, [data.mediaType, data.fonts, data.mediaUrl, data.id, updateCard]);

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
      className={clsx(
        "absolute flex flex-col items-center group select-none pt-1 pb-1.5 px-1 rounded-[2rem]", // Top 4px (pt-1), Bottom 6px (pb-1.5), Horizontal 4px (px-1)
        "bg-black/30 backdrop-blur-md",
        "w-fit h-fit min-w-[300px] max-w-[500px]", // Fit content (width and height) with constraints
        "cursor-grab active:cursor-grabbing",
        isSearchActive && !isSearchMatch && "pointer-events-auto"
      )}
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${data.x}px, ${data.y}px, 0)`,
        opacity: isSearchActive && !isSearchMatch ? 0.25 : 1,
        transition: 'opacity 0.3s ease, box-shadow 0.3s ease',
        boxShadow: isSearchMatch ? '0 0 0 3px #ccff00, 0 0 24px rgba(204,255,0,0.35)' : undefined,
        borderRadius: '2rem',
      }}
      onClick={(e) => {
        e.stopPropagation();

        // Check if we're in connection mode
        const toolMode = (window as any).whiteboardToolMode;
        const connectionStart = (window as any).whiteboardConnectionStart;

        if (toolMode === 'connection') {
          if (!connectionStart) {
            // First card selected
            (window as any).whiteboardSetConnectionStart?.(data.id);
          } else if (connectionStart !== data.id) {
            // Second card selected, create connection
            (window as any).whiteboardAddConnection?.(connectionStart, data.id);
          }
        } else {
          // Normal selection with multi-select support
          selectCard(data.id, e.shiftKey);
        }
      }}
    >
      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeCard(data.id);
        }}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-red-500/80 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        title="Delete card"
      >
        <X className="w-4 h-4 text-white" />
      </button>

      {/* Floating Tags Container */}
      <div className="relative w-full flex justify-center items-center mb-6">
        {/* Central Image/Video */}
        <div
          className={clsx(
            "relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-300",
            "w-full h-auto max-h-[500px]", // Hug content, maintain aspect ratio
            isSelected && data.color ? `ring-4 ring-transparent` : isSelected ? "ring-4 ring-[#ccff00]/50" : ""
          )}
          style={{
            ...(isSelected && data.color ? { boxShadow: `0 0 0 4px ${data.color}50` } : {})
          }}
          onMouseEnter={() => videoRef.current?.play()}
          onMouseLeave={() => videoRef.current?.pause()}
        >
          {data.mediaUrl ? (
            data.mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={data.mediaUrl}
                className="w-full h-auto object-contain pointer-events-none"
                loop
                muted
                playsInline
              />
            ) : (
              <img src={data.mediaUrl} alt={data.title} className="w-full h-auto object-contain pointer-events-none" />
            )
          ) : (
            <div className="w-full h-[300px] bg-secondary/30 flex items-center justify-center text-muted-foreground">
              No Media
            </div>
          )}

          {/* Glowing Dots (Design DNA) */}
          {data.designAnnotations && data.designAnnotations.map((ann) => (
            <div
              key={ann.id}
              className="absolute group/dot"
              style={{
                left: `${ann.x}%`,
                top: `${ann.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {/* The pulsing dot */}
              <div className="relative w-5 h-5 flex items-center justify-center cursor-help">
                <div className="absolute inset-0 bg-[#ccff00] rounded-full animate-ping opacity-60"></div>
                <div className="relative w-2.5 h-2.5 bg-[#ccff00] rounded-full shadow-[0_0_8px_#ccff00]"></div>
              </div>

              {/* The hover popover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none opacity-0 group-hover/dot:opacity-100 transition-opacity duration-200 z-50">
                <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl py-2 px-3.5 flex flex-col items-center whitespace-nowrap shadow-xl">
                  <span className="text-[10px] text-white/50 uppercase tracking-wider font-mono mb-0.5">{ann.label}</span>
                  <span className="text-sm font-semibold text-[#ccff00]">{ann.value}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Card Actions Overlay */}
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
            {data.mediaType !== 'video' && (
              <button 
                onClick={handleExtractDNA}
                disabled={extractingDNA}
                className="p-2 bg-black/30 backdrop-blur-md rounded-full hover:bg-black/60 text-white transition-colors disabled:opacity-50"
                title="Extract Design DNA (Measurements)"
              >
                {extractingDNA ? <RefreshCw className="w-4 h-4 animate-spin text-[#ccff00]" /> : <Ruler className="w-4 h-4 hover:text-[#ccff00]" />}
              </button>
            )}
            <button className="p-2 bg-black/30 backdrop-blur-md rounded-full hover:bg-black/60 text-white transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
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
      {data.mediaType !== 'video' && (
        <div className="w-full px-4 mb-3">
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
        {(extractingFonts || data.fonts !== undefined) && getGeminiKey() && data.mediaType !== 'video' && (
          <motion.div
            className="w-full px-3 mb-4"
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
              {/* Only show retry when result was empty — fonts successfully found should stay locked */}
              {(!data.fonts || data.fonts.length === 0) && (
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

      {/* Content Area */}
      <div className="w-full px-2 space-y-4 text-center">
        {/* Why did I save this? */}
        <div className="space-y-2">
          <div className="text-sm font-bold text-[#ccff00] tracking-wide font-mono uppercase opacity-80">
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
        </div>

        {/* Voice Memos & Link */}
        <div className="flex items-center justify-center gap-3 pt-1">
          {data.link && (
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
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleRecordToggle}
              className={clsx(
                "p-1.5 rounded-full transition-colors",
                isRecording ? "bg-red-500 text-white animate-pulse" : "bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white"
              )}
            >
              {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3 h-3" />}
            </button>

            {data.voiceMemos.length > 0 && (
              <div className="flex gap-2">
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
                    <span className="text-[10px] font-mono">0:23</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
