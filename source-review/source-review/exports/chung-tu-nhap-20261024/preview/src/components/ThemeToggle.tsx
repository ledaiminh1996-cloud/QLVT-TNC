import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
    try { localStorage.setItem('tnc_theme', next ? 'dark' : 'light'); } catch { /* Theme still works when storage is unavailable. */ }
  }
  return <button type="button" onClick={toggle} aria-pressed={dark} aria-label="Chế độ tối" title={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>;
}
