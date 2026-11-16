'use client';

import React, { useState } from 'react';

interface PosterWord {
  text: string;
  lang: string;
  size: string;
  weight: string;
  color: string;
  dir?: 'rtl' | 'ltr';
}

const WORDS: PosterWord[] = [
  // Top band
  { text: 'Здравствуйте', lang: 'Russian', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'CIAO', lang: 'Italian', size: 'text-xl sm:text-2xl md:text-3xl', weight: 'font-black tracking-tight', color: 'text-white' },
  { text: 'HALLO', lang: 'German', size: 'text-base sm:text-xl', weight: 'font-normal tracking-wide', color: 'text-zinc-100' },
  { text: 'सुस्वागतम्', lang: 'Sanskrit', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'MERHABA', lang: 'Turkish', size: 'text-xl sm:text-2xl md:text-3xl', weight: 'font-light tracking-widest', color: 'text-white' },
  { text: 'TERVE', lang: 'Finnish', size: 'text-xs sm:text-sm', weight: 'font-bold', color: 'text-zinc-300' },
  { text: '你好', lang: 'Chinese', size: 'text-xl sm:text-2xl md:text-3xl', weight: 'font-bold', color: 'text-white' },
  { text: 'CZEŚĆ', lang: 'Polish', size: 'text-base sm:text-xl', weight: 'font-black tracking-tight', color: 'text-zinc-100' },
  { text: 'OLÁ', lang: 'Portuguese', size: 'text-xl sm:text-2xl md:text-3xl', weight: 'font-black', color: 'text-white' },
  { text: 'السلام عليكم', lang: 'Arabic', size: 'text-lg sm:text-xl md:text-2xl', weight: 'font-bold', color: 'text-white', dir: 'rtl' },
  { text: 'KAIXO', lang: 'Basque', size: 'text-[11px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'HOLA', lang: 'Spanish', size: 'text-2xl sm:text-3xl md:text-4xl', weight: 'font-extralight tracking-tight', color: 'text-white' },
  { text: 'வணக்கம்', lang: 'Tamil', size: 'text-xs sm:text-sm', weight: 'font-bold', color: 'text-zinc-100' },

  // Centerpiece anchors (HELLO prominently centered, surrounding world greetings)
  { text: 'SALUTON', lang: 'Esperanto', size: 'text-sm sm:text-base', weight: 'font-light tracking-widest', color: 'text-zinc-200' },
  { text: 'నమస్కారం', lang: 'Telugu', size: 'text-xs sm:text-sm', weight: 'font-semibold', color: 'text-zinc-100' },
  { text: 'ALOHA', lang: 'Hawaiian', size: 'text-base sm:text-lg', weight: 'font-bold tracking-wide', color: 'text-zinc-100' },
  { text: 'HELLO', lang: 'English', size: 'text-4xl sm:text-5xl md:text-6xl', weight: 'font-black tracking-tighter leading-none', color: 'text-white' },
  { text: 'こんにちは', lang: 'Japanese', size: 'text-xl sm:text-2xl md:text-3xl', weight: 'font-bold', color: 'text-white' },
  { text: 'BONJOUR', lang: 'French', size: 'text-2xl sm:text-3xl md:text-4xl', weight: 'font-black tracking-tight', color: 'text-white' },
  { text: 'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ', lang: 'Punjabi', size: 'text-xs sm:text-sm', weight: 'font-bold', color: 'text-zinc-100' },
  { text: 'HEJ', lang: 'Swedish', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'XIN CHÀO', lang: 'Vietnamese', size: 'text-sm sm:text-base', weight: 'font-bold', color: 'text-zinc-100' },

  // Lower / Base anchors
  { text: 'HALO', lang: 'Indonesian', size: 'text-2xl sm:text-3xl md:text-4xl', weight: 'font-black tracking-tight', color: 'text-white' },
  { text: 'নমস্কার', lang: 'Bengali', size: 'text-xs sm:text-sm', weight: 'font-bold', color: 'text-zinc-100' },
  { text: 'ПРИВІТ', lang: 'Ukrainian', size: 'text-base sm:text-xl', weight: 'font-bold', color: 'text-zinc-200' },
  { text: 'HOI', lang: 'Dutch', size: 'text-sm sm:text-base', weight: 'font-bold', color: 'text-zinc-200' },
  { text: 'درود', lang: 'Persian', size: 'text-base sm:text-lg', weight: 'font-bold', color: 'text-white', dir: 'rtl' },
  { text: '안녕하세요', lang: 'Korean', size: 'text-base sm:text-lg md:text-xl', weight: 'font-bold', color: 'text-zinc-100' },
  { text: 'नमस्ते', lang: 'Hindi', size: 'text-2xl sm:text-3xl md:text-4xl', weight: 'font-black', color: 'text-white' },
  { text: 'שלום', lang: 'Hebrew', size: 'text-lg sm:text-xl md:text-2xl', weight: 'font-bold', color: 'text-white', dir: 'rtl' },
  { text: 'สวัสดี', lang: 'Thai', size: 'text-xs sm:text-sm', weight: 'font-bold', color: 'text-zinc-100' },
  { text: 'KUMUSTA', lang: 'Tagalog', size: 'text-xs sm:text-sm', weight: 'font-semibold', color: 'text-zinc-200' },
  { text: 'JAMBO', lang: 'Swahili', size: 'text-xs sm:text-sm', weight: 'font-bold', color: 'text-zinc-100' },
  { text: 'ΓΕΙΑ ΣΟΥ', lang: 'Greek', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },

  // Surrounding world languages (each exactly one unique language)
  { text: 'SZIA', lang: 'Hungarian', size: 'text-[10px] sm:text-xs', weight: 'font-semibold', color: 'text-zinc-300' },
  { text: 'AHOJ', lang: 'Czech', size: 'text-[11px] sm:text-xs', weight: 'font-bold', color: 'text-zinc-200' },
  { text: 'BUNĂ', lang: 'Romanian', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'કેમ છો', lang: 'Gujarati', size: 'text-xs sm:text-sm', weight: 'font-bold', color: 'text-zinc-200' },
  { text: 'HEI', lang: 'Norwegian', size: 'text-[11px] sm:text-xs', weight: 'font-semibold', color: 'text-zinc-300' },
  { text: 'GODDAG', lang: 'Danish', size: 'text-[10px] sm:text-xs', weight: 'font-normal tracking-wide', color: 'text-zinc-300' },
  { text: 'SALVE', lang: 'Latin', size: 'text-[10px] sm:text-xs', weight: 'font-bold tracking-widest', color: 'text-zinc-200' },
  { text: 'DIA DHUIT', lang: 'Irish', size: 'text-[10px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'SHWMAE', lang: 'Welsh', size: 'text-[10px] sm:text-xs', weight: 'font-semibold', color: 'text-zinc-300' },
  { text: 'KIA ORA', lang: 'Maori', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'HALLÓ', lang: 'Icelandic', size: 'text-[10px] sm:text-xs', weight: 'font-semibold', color: 'text-zinc-300' },
  { text: 'LABAS', lang: 'Lithuanian', size: 'text-[10px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'SVEIKI', lang: 'Latvian', size: 'text-[10px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'TERE', lang: 'Estonian', size: 'text-[10px] sm:text-xs', weight: 'font-semibold', color: 'text-zinc-300' },
  { text: 'გამარჯობა', lang: 'Georgian', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'ԲԱՐԵՎ', lang: 'Armenian', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'САЙН БАЙНА УУ', lang: 'Mongolian', size: 'text-[10px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'ආයුබෝවන්', lang: 'Sinhala', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'မင်္ဂလာပါ', lang: 'Burmese', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'សួស្តី', lang: 'Khmer', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'ສະບາຍດີ', lang: 'Lao', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'བཀྲ་ཤིས་བདེ་ལེགས', lang: 'Tibetan', size: 'text-[10px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'ሰላም', lang: 'Amharic', size: 'text-xs sm:text-sm', weight: 'font-bold', color: 'text-zinc-100' },
  { text: 'SALAAN', lang: 'Somali', size: 'text-[10px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'SAWUBONA', lang: 'Zulu', size: 'text-xs sm:text-sm', weight: 'font-semibold', color: 'text-zinc-200' },
  { text: 'Ẹ N LẸ', lang: 'Yoruba', size: 'text-[10px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'NNỌỌ', lang: 'Igbo', size: 'text-[10px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'TALOFA', lang: 'Samoan', size: 'text-[10px] sm:text-xs', weight: 'font-semibold', color: 'text-zinc-300' },
  { text: 'BULA', lang: 'Fijian', size: 'text-[11px] sm:text-xs', weight: 'font-bold', color: 'text-zinc-200' },
  { text: 'BON DIA', lang: 'Catalan', size: 'text-[10px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'ЗДРАВЕЙ', lang: 'Bulgarian', size: 'text-[10px] sm:text-xs', weight: 'font-medium', color: 'text-zinc-300' },
  { text: 'ZDRAVO', lang: 'Croatian', size: 'text-[10px] sm:text-xs', weight: 'font-semibold', color: 'text-zinc-300' },
  { text: 'آداب', lang: 'Urdu', size: 'text-xs sm:text-sm', weight: 'font-semibold', color: 'text-zinc-100', dir: 'rtl' },
  { text: 'ನಮಸ್ಕಾರ', lang: 'Kannada', size: 'text-xs sm:text-sm', weight: 'font-semibold', color: 'text-zinc-200' },
  { text: 'നമസ്കാരം', lang: 'Malayalam', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
  { text: 'नमस्कार', lang: 'Marathi', size: 'text-xs sm:text-sm', weight: 'font-medium', color: 'text-zinc-200' },
];


export function MultilingualShowcase() {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  return (
    <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-32 border-t border-white/[0.08]">
      {/* ── Header with Single Title Name ── */}
      <div className="space-y-3 mb-10 sm:mb-12">
        <div className="text-xs font-sans uppercase tracking-widest text-zinc-400">
          Languages
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
          Expanding support for many languages
        </h2>
        <p className="text-zinc-300 text-sm sm:text-base max-w-2xl leading-relaxed">
          OpenLyryc works with songs in dozens of languages. From English and Spanish to Hindi, Japanese, Arabic, and Korean — every word stays sharp, properly spaced, and locked to the music.
        </p>
      </div>

      {/* ── High-Contrast Compact Dark Poster ── */}
      <div className="relative w-full rounded-2xl bg-[#09090d] border border-white/[0.12] p-5 sm:p-7 md:p-8 overflow-hidden shadow-[0_16px_60px_rgba(0,0,0,0.7)] select-none">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_50%,rgba(255,255,255,0.05),transparent_80%)] pointer-events-none" />

        {/* Dense, Interlocking Typographic Cloud */}
        <div className="relative z-10 flex flex-wrap items-baseline justify-center gap-x-2.5 sm:gap-x-4 md:gap-x-5 gap-y-1 sm:gap-y-1.5 md:gap-y-2 max-w-5xl mx-auto text-center leading-tight">
          {WORDS.map((word, idx) => {
            const isHovered = activeTooltip === `${word.text}-${idx}`;

            return (
              <div
                key={`${word.text}-${idx}`}
                className="relative inline-flex items-center justify-center cursor-default group py-0.5"
                onMouseEnter={() => setActiveTooltip(`${word.text}-${idx}`)}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <span
                  dir={word.dir || 'ltr'}
                  className={`${word.size} ${word.weight} ${word.color} transition-colors duration-150 group-hover:text-white`}
                >
                  {word.text}
                </span>

                {/* Clean hover language pill */}
                {isHovered && (
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-white text-zinc-950 text-[10px] font-sans font-semibold whitespace-nowrap shadow-xl pointer-events-none z-30">
                    {word.lang}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── 1-Row Highlights Strip (Clean Text without Icons) ── */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.08] text-xs">
          <div className="text-zinc-300">
            <span className="text-white font-medium">Right-to-Left</span>
            <span className="text-zinc-400 block text-[11px] mt-0.5">Arabic, Hebrew, Urdu</span>
          </div>
          <div className="text-zinc-300">
            <span className="text-white font-medium">East Asian</span>
            <span className="text-zinc-400 block text-[11px] mt-0.5">Japanese, Chinese, Korean</span>
          </div>
          <div className="text-zinc-300">
            <span className="text-white font-medium">Indian Scripts</span>
            <span className="text-zinc-400 block text-[11px] mt-0.5">Hindi, Tamil, Telugu, Punjabi</span>
          </div>
          <div className="text-zinc-300">
            <span className="text-white font-medium">Standard Exports</span>
            <span className="text-zinc-400 block text-[11px] mt-0.5">.LRC and .TTML</span>
          </div>
        </div>
      </div>
    </section>
  );
}
