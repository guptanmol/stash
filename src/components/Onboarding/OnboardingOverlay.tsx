import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  X,
  ImagePlus,
  Palette,
  Sparkles,
  LayoutGrid,
  Mic,
} from 'lucide-react';

const ONBOARDING_KEY = 'stash-onboarding-completed';

interface Step {
  id: string;
  icon: React.ReactNode;
  accentColor: string;
  title: string;
  subtitle: string;
  description: string;
  tip: string;
}

const steps: Step[] = [
  {
    id: 'drop',
    icon: <ImagePlus className="w-5 h-5" />,
    accentColor: '#ccff00',
    title: 'Drop & Paste',
    subtitle: 'Add your inspiration',
    description:
      'Drag images or videos straight onto the canvas, or paste from your clipboard with ⌘V. Each drop creates a beautiful card automatically.',
    tip: '⌘V  to paste  ·  Drag files to drop',
  },
  {
    id: 'colors',
    icon: <Palette className="w-5 h-5" />,
    accentColor: '#ff6b6b',
    title: 'Auto Color Extraction',
    subtitle: 'Instant palettes',
    description:
      'Every image you add is scanned for its dominant brand colors. Click any swatch to copy the hex. Hit the ↻ button to re-extract anytime.',
    tip: 'Click a swatch to copy hex code',
  },
  {
    id: 'fonts',
    icon: <Sparkles className="w-5 h-5" />,
    accentColor: '#a855f7',
    title: 'AI Font Detection',
    subtitle: 'Powered by Gemini Vision',
    description:
      'Add your Gemini API key in the ✨ menu and every image will have its typefaces identified automatically — with links to Google Fonts.',
    tip: '✨ button in the top bar  →  Add API key',
  },
  {
    id: 'organize',
    icon: <LayoutGrid className="w-5 h-5" />,
    accentColor: '#38bdf8',
    title: 'Sections & Connections',
    subtitle: 'Organize your ideas',
    description:
      'Draw sections to group cards. Use the Connect tool to draw lines between related pieces. Zoom and pan the infinite canvas freely.',
    tip: 'Scroll to pan  ·  ⌘-scroll or pinch to zoom',
  },
  {
    id: 'voice',
    icon: <Mic className="w-5 h-5" />,
    accentColor: '#f43f5e',
    title: 'Voice Memos',
    subtitle: 'Talk through your thinking',
    description:
      'Hit the mic on any card to record a voice note about why you saved it. Play it back anytime to recall your thought process.',
    tip: '🎙 button on each card',
  },
];

export const OnboardingOverlay = () => {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0); // -1 left, 1 right for slide direction

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      // Short delay so the app renders behind the overlay first
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }, []);

  const goNext = useCallback(() => {
    if (currentStep >= steps.length - 1) {
      dismiss();
      return;
    }
    setDirection(1);
    setCurrentStep((s) => s + 1);
  }, [currentStep, dismiss]);

  const goPrev = useCallback(() => {
    if (currentStep <= 0) return;
    setDirection(-1);
    setCurrentStep((s) => s - 1);
  }, [currentStep]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, goNext, goPrev, dismiss]);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Slide variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 320 : -320,
      opacity: 0,
      scale: 0.92,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -320 : 320,
      opacity: 0,
      scale: 0.92,
    }),
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[300] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.92) 100%)',
              backdropFilter: 'blur(12px)',
            }}
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-[520px] mx-4"
            initial={{ scale: 0.85, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            style={{
              background:
                'linear-gradient(145deg, rgba(30,30,40,0.95) 0%, rgba(18,18,24,0.98) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '28px',
              boxShadow:
                '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 120px rgba(168,85,247,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Animated accent bar at top */}
            <motion.div
              className="h-[3px] w-full"
              style={{
                background: `linear-gradient(90deg, ${step.accentColor}, ${step.accentColor}88, transparent)`,
              }}
              layoutId="accent-bar"
              transition={{ duration: 0.4 }}
            />

            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-white/10 text-white/30 hover:text-white/70 transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Step counter badge */}
            <div className="absolute top-5 left-6 z-10">
              <span
                className="text-[11px] font-mono tracking-wider px-2.5 py-1 rounded-full"
                style={{
                  background: `${step.accentColor}18`,
                  color: step.accentColor,
                  border: `1px solid ${step.accentColor}30`,
                }}
              >
                {currentStep + 1} / {steps.length}
              </span>
            </div>

            {/* Content */}
            <div className="px-8 pt-16 pb-6">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                >
                  {/* Icon + subtitle */}
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="p-1.5 rounded-lg"
                      style={{
                        background: `${step.accentColor}20`,
                        color: step.accentColor,
                      }}
                    >
                      {step.icon}
                    </div>
                    <span
                      className="text-xs font-medium uppercase tracking-wider"
                      style={{ color: `${step.accentColor}cc` }}
                    >
                      {step.subtitle}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-white text-2xl font-semibold mb-3 leading-tight">
                    {step.title}
                  </h2>

                  {/* Description */}
                  <p className="text-white/55 text-sm leading-relaxed mb-4">
                    {step.description}
                  </p>

                  {/* Tip pill */}
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.4)',
                    }}
                  >
                    <span className="text-[10px]">💡</span>
                    {step.tip}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-7">
                {/* Progress bar */}
                <div className="flex-1 mr-4">
                  <div
                    className="h-[3px] rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${step.accentColor}, ${step.accentColor}aa)`,
                      }}
                      initial={false}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </div>

                  {/* Step dots */}
                  <div className="flex gap-1.5 mt-2.5">
                    {steps.map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setDirection(i > currentStep ? 1 : -1);
                          setCurrentStep(i);
                        }}
                        className="transition-all duration-300"
                        style={{
                          width: i === currentStep ? 20 : 6,
                          height: 6,
                          borderRadius: 3,
                          background:
                            i === currentStep
                              ? step.accentColor
                              : i < currentStep
                                ? `${step.accentColor}40`
                                : 'rgba(255,255,255,0.08)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2">
                  {currentStep > 0 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={goPrev}
                      className="p-2.5 rounded-xl hover:bg-white/5 text-white/40 hover:text-white/70 transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </motion.button>
                  )}

                  <button
                    onClick={goNext}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-110 active:scale-95"
                    style={{
                      background: `linear-gradient(135deg, ${step.accentColor}, ${step.accentColor}cc)`,
                      color:
                        step.accentColor === '#ccff00'
                          ? '#000'
                          : '#fff',
                      boxShadow: `0 4px 20px ${step.accentColor}30`,
                    }}
                  >
                    {isLast ? 'Get Started' : 'Next'}
                    {!isLast && <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Skip link */}
              {!isLast && (
                <div className="text-center mt-4">
                  <button
                    onClick={dismiss}
                    className="text-[11px] text-white/20 hover:text-white/40 transition-colors"
                  >
                    Skip intro · press Esc
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
