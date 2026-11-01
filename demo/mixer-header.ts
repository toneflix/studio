import type { AudioEngine, Track } from '@toneflix/studio';

const css = `
.demo-strip { display: flex; flex-direction: column; justify-content: center; gap: 6px; height: 100%; padding: 0 10px; box-sizing: border-box; font: 12px system-ui, sans-serif; color: inherit; }
.demo-strip-top { display: flex; align-items: center; gap: 4px; }
.demo-strip-name { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
.demo-strip button { width: 22px; height: 20px; padding: 0; border: 1px solid #3a3f4a; border-radius: 4px; background: transparent; color: inherit; font: 600 11px system-ui, sans-serif; cursor: pointer; }
.demo-strip button[aria-pressed='true'][data-kind='m'] { background: #f5b53d; border-color: #f5b53d; color: #1a1406; }
.demo-strip button[aria-pressed='true'][data-kind='s'] { background: #03bfff; border-color: #03bfff; color: #03141c; }
.demo-strip input { width: 100%; margin: 0; accent-color: #03bfff; }
`;

/** Track headers with mute, solo and volume, wired to an engine's mixer. */
export const mixerHeader = (engine: AudioEngine) => {
  if (!document.getElementById('demo-strip-css')) {
    const style = document.createElement('style');

    style.id = 'demo-strip-css';
    style.textContent = css;
    document.head.append(style);
  }

  return (track: Track, cell: HTMLElement) => {
    const settings = engine.mixer.channel(track.id).settings;
    const strip = document.createElement('div');

    strip.className = 'demo-strip';
    strip.innerHTML = `
      <div class="demo-strip-top">
        <span class="demo-strip-name"></span>
        <button type="button" data-kind="m" title="Mute">M</button>
        <button type="button" data-kind="s" title="Solo">S</button>
      </div>
      <input type="range" min="0" max="1.5" step="0.01" aria-label="Volume" />`;
    strip.querySelector('.demo-strip-name')!.textContent = track.name;

    const mute = strip.querySelector<HTMLButtonElement>('[data-kind="m"]')!;
    const solo = strip.querySelector<HTMLButtonElement>('[data-kind="s"]')!;
    const volume = strip.querySelector('input')!;
    const show = () => {
      const now = engine.mixer.channel(track.id).settings;

      mute.setAttribute('aria-pressed', String(now.mute));
      solo.setAttribute('aria-pressed', String(now.solo));
    };

    volume.value = String(settings.volume);
    mute.onclick = () => engine.mixer.set(track.id, { mute: !engine.mixer.channel(track.id).settings.mute });
    solo.onclick = () => engine.mixer.set(track.id, { solo: !engine.mixer.channel(track.id).settings.solo });
    volume.oninput = () => engine.mixer.set(track.id, { volume: Number(volume.value) });
    show();
    cell.append(strip);

    const off = engine.mixer.on('change', ({ track: id }) => id === track.id && show());

    return () => {
      off();
      strip.remove();
    };
  };
};
