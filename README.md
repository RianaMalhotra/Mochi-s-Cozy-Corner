# Mochi's Cozy Corner 🐈

A tiny animated **floating desktop cat for Windows**, made with **Tauri 2 + React + TypeScript + Rust**. Mochi naps with headphones on, purrs when petted, and keeps you company during study sessions.

## Features

- Transparent, frameless 350 × 440 desktop window
- Drag using the **mochi ♡** top bar
- Animated cat: slow breathing, swishing tail, sleeping eyes, floating hearts when petted, and focus mode
- Expandable Pomodoro: 25-minute focus and 5-minute break; start, pause, reset, completion count
- Remembered timer state and session count using local storage
- Clock, always-on-top toggle, close control, accessible button labels and reduced-motion support

## Requirements

On Windows install Node.js 20+, Rust with the MSVC toolchain, Visual Studio C++ Build Tools, and Microsoft Edge WebView2. Official guide: https://v2.tauri.app/start/prerequisites/

## Development

~~~powershell
git clone https://github.com/RianaMalhotra/Mochi-s-Cozy-Corner.git
cd Mochi-s-Cozy-Corner
npm install
npm run tauri dev
~~~

For a browser-only UI preview (desktop window controls require Tauri):

~~~powershell
npm run dev
~~~

Open http://127.0.0.1:1420.

## Windows installer

~~~powershell
npm run tauri build
~~~

The NSIS/MSI installers appear under src-tauri/target/release/bundle/.

## Limitations

- This MVP is a draggable *floating window*, not a cat that autonomously walks across other application windows.
- The Pomodoro timer is not an OS background service; it pauses across application restarts.
- The transparent window still reserves its rectangular hit-testing area.
- Native Windows build verification is tracked by GitHub Actions.

The source artwork is hand-written SVG and CSS; no external cat image is required.
