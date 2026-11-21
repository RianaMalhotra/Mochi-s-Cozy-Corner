import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow, currentMonitor, PhysicalPosition, LogicalSize } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Clock3, Heart, Pause, Play, RotateCcw, Settings2, X, Pin, PinOff, Coffee, Music2 } from 'lucide-react';
import './style.css';

type Mood = 'idle' | 'sleep' | 'happy' | 'focus';
type TimerMode = 'focus' | 'rest';

const DURATION: Record<TimerMode, number> = { focus: 25 * 60, rest: 5 * 60 };
const save = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
function load<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s === null ? fallback : JSON.parse(s) as T; }
  catch { return fallback; }
}
const formatted = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const inTauri = () => '__TAURI_INTERNALS__' in window;

function Cat({ mood, onPet, headphones }: { mood: Mood; onPet: () => void; headphones: boolean }) {
  return <button className={'cat cat-' + mood} aria-label="Pet Mochi" onClick={onPet} title="Pet Mochi!">
    <svg viewBox="0 0 260 225" role="img" aria-label="Animated cream cat with lavender headphones">
      <ellipse cx="132" cy="205" rx="93" ry="13" fill="#a88aaf" opacity=".22" />
      <g className="tail">
        <path d="M188 161 C245 161 246 100 217 102 C194 104 214 129 222 118" fill="none" stroke="#d6b6a9" strokeWidth="25" strokeLinecap="round" />
        <path d="M188 161 C245 161 246 100 217 102 C194 104 214 129 222 118" fill="none" stroke="#fff1e3" strokeWidth="18" strokeLinecap="round" />
      </g>
      <g className="body">
        <ellipse cx="135" cy="164" rx="77" ry="46" fill="#fff0e3" />
        <ellipse cx="144" cy="179" rx="58" ry="22" fill="#fff8ed" />
        <path d="M85 190q-13 13-22-1m118 1q13 13 22-1" fill="none" stroke="#d9b4a8" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="head">
        <path d="M64 100L58 27Q57 15 69 24L102 55Q131 45 161 56L192 24Q204 14 203 30L195 102" fill="#fff0e3" stroke="#d9b8aa" strokeWidth="3" />
        <path d="M72 82L69 39L98 67M166 66L191 39L185 82" fill="#f5b8be" />
        <ellipse cx="130" cy="110" rx="78" ry="64" fill="#fff0e3" stroke="#e5c8bb" strokeWidth="2" />
        <ellipse cx="83" cy="126" rx="17" ry="9" fill="#f8bec6" opacity=".65" />
        <ellipse cx="177" cy="126" rx="17" ry="9" fill="#f8bec6" opacity=".65" />
        {mood === 'sleep'
          ? <g stroke="#6b5367" strokeWidth="4" fill="none" strokeLinecap="round"><path d="M85 109q13 12 26 0M149 109q13 12 26 0" /></g>
          : <g fill="#66546a"><ellipse cx="98" cy="109" rx="6" ry={mood === 'happy' ? 3 : 9} /><ellipse cx="161" cy="109" rx="6" ry={mood === 'happy' ? 3 : 9} /></g>}
        <path d="M124 126q6-7 12 0l-6 5z" fill="#d993a1" />
        <path d="M130 131q-8 11-15 0m15 0q8 11 15 0" stroke="#9f7884" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <g stroke="#d9b8aa" strokeWidth="2" strokeLinecap="round"><path d="M75 133l-25-5m25 11l-23 5m133-11l25-5m-25 11l23 5" /></g>
        {headphones && <g><path d="M74 68q56-48 112 0" stroke="#a88ba7" strokeWidth="10" fill="none" strokeLinecap="round" />
        <rect x="48" y="82" width="22" height="44" rx="11" fill="#b79bc4" />
        <rect x="190" y="82" width="22" height="44" rx="11" fill="#b79bc4" />
        <rect x="52" y="90" width="10" height="29" rx="5" fill="#e5cfe6" />
        <rect x="198" y="90" width="10" height="29" rx="5" fill="#e5cfe6" /></g>}
      </g>
      <g className="paw"><ellipse cx="103" cy="192" rx="21" ry="12" fill="#fff6e9" /><path d="M96 190v5m9-5v5" stroke="#d9b8aa" strokeWidth="2" /></g>
    </svg>
    {mood === 'sleep' && <span className="sleep-z">z z z</span>}
    {mood === 'happy' && <span className="hearts">♥ ♥</span>}
  </button>;
}

function App() {
  const [mode, setMode] = useState<TimerMode>(() => load('mochi-mode', 'focus'));
  const [remaining, setRemaining] = useState(() => load('mochi-remaining', DURATION.focus));
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(() => load('mochi-expanded', false));
  const [pinned, setPinned] = useState(true);
  const [petting, setPetting] = useState(false);
  const [feeding, setFeeding] = useState(false);
  const [carrotDrag, setCarrotDrag] = useState<{ x: number; y: number } | null>(null);
  const [carrotsFed, setCarrotsFed] = useState(() => load('mochi-carrots-fed', 0));
  const widgetRef = useRef<HTMLElement | null>(null);
  const catRef = useRef<HTMLDivElement | null>(null);
  const feedTimeout = useRef<number | null>(null);
  const [awake, setAwake] = useState(true);
  const [musicOverride, setMusicOverride] = useState(false);
  const [bluetoothHeadphones, setBluetoothHeadphones] = useState(false);
  const musicMode = bluetoothHeadphones || musicOverride;

  const lastInteraction = useRef(Date.now());
  const [sessions, setSessions] = useState(() => load('mochi-sessions', 0));
  const [clock, setClock] = useState(new Date());
  const [notice, setNotice] = useState('');
  const deadline = useRef<number | null>(null);
  const petTimeout = useRef<number | null>(null);

  const mood: Mood = petting || feeding ? 'happy' : running && mode === 'focus' ? 'focus' : !awake ? 'sleep' : 'idle';

  // Check signed GitHub releases on startup; never install without consent.
  useEffect(() => {
    if (!inTauri()) return;
    let cancelled = false;
    const checkUpdates = async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (!update) return;
        if (cancelled) { await update.close(); return; }
        const accepted = window.confirm(`Mochi ${update.version} is available! 🐱\\n\\nInstall the signed update and restart Mochi now?`);
        if (accepted) {
          setNotice('Downloading Mochi update…');
          await update.downloadAndInstall();
          const { relaunch } = await import('@tauri-apps/plugin-process');
          await relaunch();
        } else {
          await update.close();
        }
      } catch (error) {
        console.warn('Mochi update check failed', error);
      }
    };
    void checkUpdates();
    return () => { cancelled = true; };
  }, []);

  // Poll connected Bluetooth audio devices; no audio playback or default-device requirement.
  useEffect(() => {
    if (!inTauri()) return;
    let active = true;
    const refresh = async () => {
      try {
        const connected = await invoke<boolean>('bluetooth_headphones_connected');
        if (active) setBluetoothHeadphones(connected);
      } catch (error) { console.warn('Bluetooth check failed', error); }
    };
    void refresh();
    const id = window.setInterval(() => { void refresh(); }, 4000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // Windows global idle time; fallback to interactions with the widget in browser preview.
  useEffect(() => {
    const check = async () => {
      let idle = Math.floor((Date.now() - lastInteraction.current) / 1000);
      if (inTauri()) {
        try { idle = await invoke<number>('system_idle_seconds'); } catch { /* preview fallback */ }
      }
      if (!petting) setAwake(idle < 60);
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 3000);
    return () => clearInterval(timer);
  }, [petting]);

  // Dock to the bottom-right of the current display, preserving the bottom edge when expanded.
  useEffect(() => {
    if (!inTauri()) return;
    const dock = async () => {
      try {
        const win = getCurrentWindow();
        const monitor = await currentMonitor();
        await win.setSize(new LogicalSize(220, expanded ? 405 : 255));
        if (monitor) {
          const scale = monitor.scaleFactor;
          const width = Math.round(220 * scale);
          const height = Math.round((expanded ? 405 : 255) * scale);
          await win.setPosition(new PhysicalPosition(monitor.position.x + monitor.size.width - width - Math.round(16 * scale), monitor.position.y + monitor.size.height - height - Math.round(48 * scale)));
        }
      } catch (error) { console.warn('Unable to dock Mochi', error); }
    };
    void dock();
  }, [expanded]);

  useEffect(() => {
    save('mochi-mode', mode);
    save('mochi-remaining', remaining);
    save('mochi-expanded', expanded);
    save('mochi-sessions', sessions);
    save('mochi-carrots-fed', carrotsFed);
  }, [mode, remaining, expanded, sessions, carrotsFed]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil(((deadline.current ?? Date.now()) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        deadline.current = null;
        if (mode === 'focus') {
          setSessions(n => n + 1);
          setNotice('Focus complete! Time for a break ✨');
        } else {
          setNotice('Break complete! Mochi is ready 🐾');
        }
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running, mode]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => () => {
    if (petTimeout.current !== null) clearTimeout(petTimeout.current);
    if (feedTimeout.current !== null) clearTimeout(feedTimeout.current);
  }, []);

  const pet = () => {
    lastInteraction.current = Date.now();
    setAwake(true);
    setPetting(true);
    if (petTimeout.current !== null) clearTimeout(petTimeout.current);
    petTimeout.current = window.setTimeout(() => setPetting(false), 1300);
  };

  const carrotPosition = (e: React.PointerEvent) => {
    const rect = widgetRef.current?.getBoundingClientRect();
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null;
  };

  const startCarrotDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setCarrotDrag(carrotPosition(e));
  };

  const moveCarrot = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (carrotDrag !== null) setCarrotDrag(carrotPosition(e));
  };

  const dropCarrot = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (carrotDrag === null) return;
    const bounds = catRef.current?.getBoundingClientRect();
    const fed = !!bounds && e.clientX >= bounds.left + 35 && e.clientX <= bounds.right - 35
      && e.clientY >= bounds.top + 30 && e.clientY <= bounds.bottom - 10;
    setCarrotDrag(null);
    if (!fed) return;
    setCarrotsFed(n => n + 1);
    setAwake(true);
    setFeeding(true);
    setNotice('nom nom! thank you for the carrot 🥕 ♡');
    if (feedTimeout.current !== null) clearTimeout(feedTimeout.current);
    feedTimeout.current = window.setTimeout(() => setFeeding(false), 1600);
  };

  const drag = async (e: React.PointerEvent) => {
    if (e.button !== 0 || !inTauri()) return;
    try { await getCurrentWindow().startDragging(); } catch (error) { console.warn(error); }
  };

  const togglePin = async () => {
    if (!inTauri()) { setPinned(v => !v); return; }
    try {
      await getCurrentWindow().setAlwaysOnTop(!pinned);
      setPinned(v => !v);
    } catch (error) { console.warn(error); }
  };

  const close = async () => {
    if (inTauri()) await getCurrentWindow().close();
    else setNotice('Close is available in the desktop app');
  };

  const pauseOrStart = () => {
    if (running) {
      const left = Math.max(0, Math.ceil(((deadline.current ?? Date.now()) - Date.now()) / 1000));
      setRemaining(left);
      setRunning(false);
      deadline.current = null;
    } else {
      const seconds = remaining > 0 ? remaining : DURATION[mode];
      setRemaining(seconds);
      deadline.current = Date.now() + seconds * 1000;
      setRunning(true);
    }
  };

  const selectMode = (next: TimerMode) => {
    setRunning(false);
    deadline.current = null;
    setMode(next);
    setRemaining(DURATION[next]);
  };

  const reset = () => {
    setRunning(false);
    deadline.current = null;
    setRemaining(DURATION[mode]);
  };

  return <main ref={widgetRef} className={`widget ${expanded ? "widget-expanded" : ""}`} onPointerDown={() => { lastInteraction.current = Date.now(); setAwake(true); }}>
    <div className="dragbar" onPointerDown={drag} title="Drag to move Mochi">
      <span className="brand">✿ mochi<span className="brand-heart">♡</span></span>
      <span className="drag-hint">⋮⋮ drag me</span>
    </div>
    <div className="window-actions">
      <button onClick={togglePin} title={pinned ? 'Unpin from top' : 'Keep on top'} aria-label="Toggle always on top">
        {pinned ? <Pin size={14} /> : <PinOff size={14} />}
      </button>
      <button onClick={() => setExpanded(v => !v)} title="Toggle timer" aria-label="Toggle timer"><Settings2 size={15} /></button>
      <button onClick={close} title="Close Mochi" aria-label="Close Mochi"><X size={16} /></button>
    </div>
    <div className="stars" aria-hidden="true">✦ <span>·</span> ✧ <span>✦</span></div>
    <div className={`cat-wrap ${carrotDrag ? "cat-feed-target" : ""} ${feeding ? "cat-eating" : ""}`} ref={catRef}><Cat mood={mood} onPet={pet} headphones={musicMode} /></div>
    <button className="carrot-basket" aria-label="Drag carrot onto Mochi to feed" title="Drag a carrot onto Mochi!" onPointerDown={startCarrotDrag} onPointerMove={moveCarrot} onPointerUp={dropCarrot} onPointerCancel={() => setCarrotDrag(null)}>🥕</button>
    {carrotDrag && <span className="carrot-floating" style={{ left: carrotDrag.x, top: carrotDrag.y }} aria-hidden="true">🥕</span>}
    {feeding && <span className="nom-bubble" aria-hidden="true">nom nom ♡</span>}
    <div className="floor" aria-hidden="true" />
    <div className="status">
      <span className="status-dot" /> {mood === 'sleep' ? 'sleeping… zzz' : mood === 'focus' ? 'studying with you ♡' : mood === 'happy' ? 'purr purr ♡' : 'here to keep you company'}
    </div>
    <div className="bottom">
      <div className="clock"><Clock3 size={14} /><span>{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
      <button className="focus-button" onClick={() => setExpanded(v => !v)}><Coffee size={15} /> focus timer <span>{expanded ? '⌄' : '⌃'}</span></button>
      <button className={`music-button ${musicMode ? "active" : ""}`} onClick={() => setMusicOverride(v => !v)} aria-label="Toggle headphone override" title={bluetoothHeadphones ? "Bluetooth headphones connected" : "Toggle headphone override"}><Music2 size={15} /></button>
      <button className="heart-button" onClick={pet} aria-label="Pet Mochi"><Heart size={17} fill="#f3a7b8" /></button>
    </div>
    {expanded && <section className="timer" aria-label="Pomodoro timer">
      <div className="timer-top"><span>🍓 little focus corner</span><span>{sessions} sessions</span></div>
      <div className="tabs">
        <button className={mode === 'focus' ? 'selected' : ''} onClick={() => selectMode('focus')}>Focus · 25m</button>
        <button className={mode === 'rest' ? 'selected' : ''} onClick={() => selectMode('rest')}>Break · 5m</button>
      </div>
      <div className="timer-row">
        <strong aria-live="off">{formatted(remaining)}</strong>
        <div className="timer-actions">
          <button aria-label={running ? 'Pause timer' : 'Start timer'} onClick={pauseOrStart}>
            {running ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button aria-label="Reset timer" onClick={reset}><RotateCcw size={17} /></button>
        </div>
      </div>
      <div className="progress"><div style={{ width: (100 * (1 - remaining / DURATION[mode])) + '%' }} /></div>
      <p>Mochi believes in you! ♡</p>
    </section>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
