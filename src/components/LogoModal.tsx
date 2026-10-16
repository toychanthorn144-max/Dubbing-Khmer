import React, { useRef, useState } from 'react';
import { X, Upload, RotateCcw, Check, Sparkles, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { useLogo } from '../context/LogoContext';

interface LogoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogoModal: React.FC<LogoModalProps> = ({ isOpen, onClose }) => {
  const { logoUrl, creatorName, updateLogo, resetLogo } = useLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('សូមជ្រើសរើសឯកសារជារូបភាព (PNG, JPG, SVG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        updateLogo(dataUrl);
        setSuccessMsg('បានបញ្ចូលរូបភាព Logo ថ្មីជោគជ័យ!');
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    resetLogo();
    setSuccessMsg('បានកំណត់ Logo ដើមផ្លូវការឡើងវិញ!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl shadow-indigo-950/50 text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">ផ្លាកសញ្ញាកម្មវិធី (App Logo)</h3>
              <p className="text-xs text-slate-400">គ្រប់គ្រង និងផ្លាស់ប្តូរ Logo កម្មវិធី</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Current Active Logo Preview */}
        <div className="my-5 p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-center gap-5">
          <div className="relative group">
            <img
              src={logoUrl}
              alt="Active App Logo"
              className="w-24 h-24 rounded-2xl border-2 border-amber-500/40 object-cover shadow-xl shadow-amber-500/10 bg-slate-900 p-1"
            />
            <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
              Active
            </span>
          </div>

          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <div className="text-xs font-semibold text-slate-300">
              កម្មវិធី: <span className="text-indigo-300">Khmer AI Video Dubber</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25">
              <span>អ្នកបង្កើតកម្មវិធី:</span>
              <strong className="text-amber-200 font-bold">{creatorName}</strong>
            </div>
            <p className="text-[11px] text-slate-400">
              Logo នេះនឹងត្រូវបង្ហាញនៅលើ Header, Banner, Footer និង Watermark វីដេអូ។
            </p>
          </div>
        </div>

        {/* Upload Action */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-indigo-400" />
            ជ្រើសរើស ឬបញ្ចូលរូបភាព Logo ផ្ទាល់ខ្លួនរបស់អ្នក:
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 border border-indigo-400/30 transition-all hover:scale-[1.01]"
            >
              <Upload className="w-4 h-4" />
              <span>ជ្រើសរើសរូបភាពពីម៉ាស៊ីន</span>
            </button>

            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>កំណត់ Logo ដើមឡើងវិញ</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            គាំទ្រប្រភេទរូបភាព: PNG, JPG, WebP, SVG (រូបថត ឬ Logo ផ្ទាល់ខ្លួន អាចបញ្ចូលបានភ្លាមៗ)
          </p>
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
          >
            បិទ (Close)
          </button>
        </div>

      </div>
    </div>
  );
};
