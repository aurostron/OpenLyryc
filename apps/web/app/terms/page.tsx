import React from 'react';
import type { Metadata } from 'next';
import { SiteLayout } from '@/components/SiteLayout';
import { Scale, FileCode, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Use & License | OpenLyryc',
  description: 'Terms of use and MIT open-source license information for OpenLyryc.',
};

export default function TermsPage() {
  return (
    <SiteLayout activePage="terms">
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <header className="space-y-4">
          <div className="text-xs font-sans uppercase tracking-widest text-zinc-500">
            Terms of Use
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
            Terms & MIT License
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed pt-2">
            OpenLyryc is open-source software provided under the MIT License.
            You are free to use, modify, distribute, and integrate it into your own workflows.
          </p>
        </header>

        {/* Ownership of Your Works */}
        <section className="mt-16 space-y-6 border-t border-white/[0.08] pt-12">
          <div className="flex items-center gap-2 text-white font-medium text-xl tracking-tight">
            <Scale className="w-5 h-5 text-zinc-400" />
            <h2>Your ownership rights</h2>
          </div>
          <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
            <p>
              You own all intellectual property rights to the lyrics, audio recordings, and synchronization
              timing files you create or edit using OpenLyryc. OpenLyryc does not claim any ownership or copyright
              over your exported LRC, TTML, or JSON files.
            </p>
            <p>
              You are solely responsible for ensuring you have the appropriate legal rights or permissions to use
              any third-party copyrighted songs or lyrics you load into the editor.
            </p>
          </div>
        </section>

        {/* Full MIT License */}
        <section className="mt-16 space-y-6 border-t border-white/[0.08] pt-12">
          <div className="flex items-center gap-2 text-white font-medium text-xl tracking-tight">
            <FileCode className="w-5 h-5 text-zinc-400" />
            <h2>The MIT License</h2>
          </div>

          <div className="p-6 rounded-xl border border-white/[0.08] bg-[#0c0c0f] font-sans text-[11px] text-zinc-300 leading-relaxed select-all">
            <div className="text-zinc-500 mb-3">Copyright (c) 2026 OpenLyryc contributors</div>
            <p className="mb-3">
              Permission is hereby granted, free of charge, to any person obtaining a copy
              of this software and associated documentation files (the &quot;Software&quot;), to deal
              in the Software without restriction, including without limitation the rights
              to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
              copies of the Software, and to permit persons to whom the Software is
              furnished to do so, subject to the following conditions:
            </p>
            <p className="mb-3">
              The above copyright notice and this permission notice shall be included in all
              copies or substantial portions of the Software.
            </p>
            <p>
              THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
              AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
              LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
              OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
              SOFTWARE.
            </p>
          </div>
        </section>

        {/* Permitted Uses Quick Check */}
        <section className="mt-16 space-y-4 border-t border-white/[0.08] pt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 font-sans">
            Permissions summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-300">
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Commercial use permitted</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Modification permitted</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Distribution permitted</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Private & educational use</span>
            </div>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
