<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { withBase } from 'vitepress';
import type { AudioEngine, StudioTimeline, StudioToolbar } from '@toneflix/studio';

const host = ref<HTMLElement>();
const timeline = shallowRef<StudioTimeline>();
const engine = shallowRef<AudioEngine>();
const toolbar = shallowRef<StudioToolbar>();
const actions = ref<HTMLElement>();
let unlink = () => {};
const copied = ref(false);
const install = 'pnpm add @toneflix/studio';

const features = [
  {
    title: 'Edit without limits',
    text: 'Split anything, drag clips anywhere, layer them and move them between tracks. Nothing snaps back unless you ask it to.',
    icon: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
  },
  {
    title: 'Fast with big sessions',
    text: 'Waveforms are drawn in the background and cached on the device, so long recordings open instantly the next time.',
    icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  },
  {
    title: 'Fits any stack',
    text: 'No framework and no dependencies. Use the built-in toolbar and track controls with your own icons, or build your own UI.',
    icon: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  },
  {
    title: 'Open by design',
    text: 'MIT licensed, with plain data you can save anywhere. Swapping projects with desktop DAWs is on the roadmap.',
    icon: 'M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6A5 5 0 0 1 6 7h3m-1 5h8',
  },
];

const uses = ['Music apps', 'Podcast editors', 'Classrooms', 'AI audio tools', 'Games', 'Sample libraries'];

const roadmap = [
  { stage: 'Available', title: 'Edit, mix and play', text: 'Free clip editing, cached waveforms, one undo history, and playback with a mixer, live plugins, loops and a metronome.' },
  { stage: 'Available', title: 'Recording', text: 'Record over the mix onto any track, lined up with what was heard, with the waveform drawn as you record.' },
  { stage: 'Planned', title: 'DAW project exchange', text: 'Open and save sessions that travel to and from desktop studios.' },
];

const copy = async () => {
  try {
    await navigator.clipboard.writeText(install);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    copied.value = false;
  }
};

onMounted(async () => {
  const { AudioEngine, linkPlayback, linkRecorder, PluginRack, Recorder, StudioMixer, StudioTimeline, StudioToolbar, trackStrip, uid, Waveforms } = await import('@toneflix/studio');
  const { loadSample } = await import('../../../demo/sample.ts');
  const narrow = host.value!.clientWidth < 640;
  const audio = new AudioEngine();
  const recorder = new Recorder(audio);
  const plugins = new PluginRack(audio);
  const waveforms = new Waveforms();
  const plugin = (name: string, file: string) => ({ name, url: new URL(withBase(`/plugins/${file}`), location.href).href });
  const view = new StudioTimeline(host.value!, {
    grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
    headerWidth: narrow ? 112 : 168,
    pxPerSecond: narrow ? 24 : 52,
    palette: ['#03bfff', '#8b7cff', '#ff5c8a', '#2fd07f', '#f5b53d'],
    createTrack: () => ({ id: uid('t'), name: 'New track' }),
    renderHeader: trackStrip(audio, { recorder }),
  });

  const mixer = new StudioMixer(host.value!, { timeline: view, engine: audio, plugins, catalog: [plugin('Echo', 'echo.js'), plugin('Drive', 'drive.js')], hidden: true });

  toolbar.value = new StudioToolbar(actions.value!, {
    timeline: view,
    engine: audio,
    mixer,
    recorder,
    plugins,
    items: ['play', 'stop', 'record', 'loop', 'metronome', '|', 'display', '|', 'split', 'duplicate', 'delete', '|', 'undo', 'redo', '|', 'zoomOut', 'fit', 'zoomIn', '|', 'mixer', 'meter'],
  });
  loadSample(view, { engine: audio, waveforms });

  const unlinkPlayback = linkPlayback(view, audio);
  const unlinkRecorder = linkRecorder(view, recorder, { waveforms });

  unlink = () => {
    unlinkPlayback();
    unlinkRecorder();
    recorder.destroy();
    mixer.destroy();
    plugins.destroy();
  };
  timeline.value = view;
  engine.value = audio;
});

onBeforeUnmount(() => {
  unlink();
  toolbar.value?.destroy();
  engine.value?.destroy();
  timeline.value?.destroy();
});
</script>

<template>
  <div class="landing">
    <div class="glow" aria-hidden="true" />

    <header class="topbar">
      <a class="brand" :href="withBase('/')">
        <span class="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <span>Toneflix Studio</span>
      </a>
      <nav class="topnav">
        <a :href="withBase('/guide/getting-started')">Docs</a>
        <a :href="withBase('/api/timeline')">API</a>
        <a :href="withBase('/playground')">Playground</a>
        <a href="https://github.com/toneflix/studio" target="_blank" rel="noopener">GitHub</a>
      </nav>
    </header>

    <section class="hero">
      <span class="pill">Open source · MIT · Zero dependencies</span>
      <h1>The studio engine<br /><span class="gradient">for the web.</span></h1>
      <p class="lead">Give any web app a real multitrack editor. Arrange, cut and shape audio as freely as in a desktop DAW, right in the browser.</p>
      <div class="actions">
        <a class="btn btn-primary" :href="withBase('/guide/getting-started')">Get started</a>
        <button type="button" class="install" :aria-label="`Copy ${install}`" @click="copy">
          <span class="prompt">$</span> {{ install }}
          <span class="copy">{{ copied ? 'Copied' : 'Copy' }}</span>
        </button>
      </div>
    </section>

    <section class="window" aria-label="A live timeline you can edit">
      <div class="window-bar">
        <span class="dots" aria-hidden="true"><i /><i /><i /></span>
        <span class="window-title">Untitled session</span>
      </div>
      <div ref="actions" class="window-actions" />
      <div ref="host" class="window-body" />
      <p class="window-hint">It's live. Press play, drag a clip while it plays, click the ruler and press S to split, or arm a track with R and record. The sliders button opens the mixer, where + adds a plugin.</p>
    </section>

    <section class="features">
      <article v-for="feature in features" :key="feature.title" class="feature">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="feature.icon" /></svg>
        <h3>{{ feature.title }}</h3>
        <p>{{ feature.text }}</p>
      </article>
    </section>

    <section class="split">
      <div class="split-copy">
        <span class="eyebrow">A few lines in</span>
        <h2>From an empty div to a multitrack editor.</h2>
        <p>Load tracks and clips as plain data, hand it peaks, and listen for changes. Every edit comes back as JSON you can save anywhere, and every step lands in one undo history your whole editor can share.</p>
        <a class="link" :href="withBase('/guide/getting-started')">Read the guide →</a>
      </div>
      <pre class="code"><code><span class="k">import</span> { StudioTimeline, makeClip } <span class="k">from</span> <span class="s">'@toneflix/studio'</span>;

<span class="k">const</span> studio = <span class="k">new</span> <span class="f">StudioTimeline</span>(editor, {
  grid: { bpm: <span class="n">120</span>, snap: <span class="s">'beat'</span> },
});

studio.<span class="f">load</span>({
  tracks: [{ id: <span class="s">'vox'</span>, name: <span class="s">'Vocals'</span> }],
  clips: [<span class="f">makeClip</span>({ track: <span class="s">'vox'</span>, source: <span class="s">'take-3'</span>,
    start: <span class="n">0</span>, offset: <span class="n">0</span>, duration: <span class="n">12</span> })],
});

studio.<span class="f">on</span>(<span class="s">'change'</span>, ({ state }) =&gt; <span class="f">save</span>(state));</code></pre>
    </section>

    <section class="uses">
      <span class="eyebrow">Made for</span>
      <ul>
        <li v-for="use in uses" :key="use">{{ use }}</li>
      </ul>
    </section>

    <section class="roadmap">
      <span class="eyebrow">Where it's going</span>
      <h2>A full studio, one release at a time.</h2>
      <ol>
        <li v-for="step in roadmap" :key="step.title" :class="`stage-${step.stage.toLowerCase()}`">
          <span class="stage">{{ step.stage }}</span>
          <h3>{{ step.title }}</h3>
          <p>{{ step.text }}</p>
        </li>
      </ol>
    </section>

    <section class="cta">
      <h2>Bring the studio to your app.</h2>
      <div class="actions">
        <a class="btn btn-primary" :href="withBase('/guide/getting-started')">Get started</a>
        <a class="btn btn-ghost" href="https://github.com/toneflix/studio" target="_blank" rel="noopener">Star on GitHub</a>
      </div>
    </section>

    <footer class="foot">
      <span>Toneflix Studio · MIT License</span>
      <span>
        <a :href="withBase('/guide/getting-started')">Docs</a>
        <a href="https://www.npmjs.com/package/@toneflix/studio" target="_blank" rel="noopener">npm</a>
        <a href="https://github.com/toneflix/studio" target="_blank" rel="noopener">GitHub</a>
      </span>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  padding: 0 24px;
  background: var(--tf-bg);
  color: var(--tf-text);
  font-family: 'Inter var', 'Inter', ui-sans-serif, system-ui, sans-serif;
}
.landing a {
  color: inherit;
  text-decoration: none;
}
.landing > section,
.topbar,
.foot {
  position: relative;
  max-width: 1120px;
  margin: 0 auto;
}
.glow {
  position: absolute;
  inset: -240px 0 auto;
  height: 900px;
  pointer-events: none;
  background:
    radial-gradient(40% 50% at 30% 30%, rgb(3 191 255 / 22%), transparent 70%),
    radial-gradient(35% 45% at 72% 22%, rgb(139 124 255 / 20%), transparent 70%),
    radial-gradient(30% 40% at 60% 60%, rgb(255 92 138 / 12%), transparent 70%);
  filter: blur(20px);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.01em;
}
.brand-mark {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  height: 22px;
}
.brand-mark i {
  width: 4px;
  border-radius: 2px;
  background: linear-gradient(var(--tf-primary), var(--tf-secondary));
}
.brand-mark i:nth-child(1) { height: 40%; }
.brand-mark i:nth-child(2) { height: 100%; }
.brand-mark i:nth-child(3) { height: 65%; }
.brand-mark i:nth-child(4) { height: 85%; }
.topnav {
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: var(--tf-text-muted);
}
.topnav a:hover {
  color: var(--tf-text);
}

.hero {
  padding: 72px 0 40px;
  text-align: center;
}
.pill {
  display: inline-block;
  padding: 6px 14px;
  border: 1px solid var(--tf-border-strong);
  border-radius: 999px;
  background: rgb(17 20 25 / 70%);
  color: var(--tf-text-muted);
  font-size: 13px;
}
.hero h1 {
  margin: 24px 0 0;
  font-size: clamp(42px, 7vw, 84px);
  line-height: 1.02;
  font-weight: 800;
  letter-spacing: -0.035em;
}
.gradient {
  background: linear-gradient(90deg, var(--tf-primary), var(--tf-secondary) 55%, var(--tf-accent));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.lead {
  max-width: 620px;
  margin: 24px auto 0;
  color: var(--tf-text-muted);
  font-size: clamp(17px, 2vw, 20px);
  line-height: 1.55;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 36px;
}
.btn {
  display: inline-flex;
  align-items: center;
  height: 48px;
  padding: 0 24px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 15px;
  transition: background 150ms, transform 150ms;
}
.btn:hover {
  transform: translateY(-1px);
}
.btn-primary {
  background: var(--tf-primary);
  color: var(--tf-on-primary) !important;
}
.btn-primary:hover {
  background: var(--tf-primary-hover);
}
.btn-ghost {
  border: 1px solid var(--tf-border-strong);
  background: rgb(17 20 25 / 70%);
}
.install {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 8px 0 18px;
  border: 1px solid var(--tf-border-strong);
  border-radius: 999px;
  background: rgb(17 20 25 / 70%);
  color: var(--tf-text);
  font: 14px ui-monospace, 'SF Mono', Menlo, monospace;
  cursor: pointer;
}
.prompt {
  color: var(--tf-primary);
}
.copy {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--tf-surface-3);
  color: var(--tf-text-muted);
  font: 600 12px 'Inter', system-ui, sans-serif;
}

.window {
  margin-top: 24px !important;
  border: 1px solid var(--tf-border-strong);
  border-radius: 16px;
  background: var(--tf-surface-1);
  box-shadow: 0 40px 120px rgb(0 0 0 / 55%), 0 0 0 1px rgb(3 191 255 / 6%);
  overflow: hidden;
}
.window-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 36px;
  padding: 0 14px;
  border-bottom: 1px solid var(--tf-border);
  background: var(--tf-surface-2);
  font-size: 13px;
}
.dots {
  display: inline-flex;
  gap: 6px;
}
.dots i {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--tf-border-strong);
}
.dots i:first-child { background: var(--tf-accent); }
.dots i:nth-child(2) { background: var(--tf-warning); }
.dots i:nth-child(3) { background: var(--tf-success); }
.window-title {
  flex: 1;
  color: var(--tf-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.window-actions {
  border-bottom: 1px solid var(--tf-border);
  --tfs-toolbar-bg: var(--tf-surface-2);
  --tfs-toolbar-text: var(--tf-text);
  --tfs-toolbar-hover: var(--tf-surface-3);
  --tfs-toolbar-line: var(--tf-border-strong);
  --tfs-toolbar-active: var(--tf-primary);
  --tfs-toolbar-active-text: var(--tf-on-primary);
  --tfs-toolbar-size: 30px;
}
.window-actions :deep(.tfs-toolbar) {
  padding: 6px 10px;
}
.window-body {
  height: 320px;
  --tfs-bg: var(--tf-surface-1);
  --tfs-lane: #0e1116;
  --tfs-lane-alt: #10141a;
  --tfs-header: var(--tf-surface-2);
  --tfs-line: rgb(255 255 255 / 5%);
  --tfs-text: var(--tf-text);
  --tfs-muted: var(--tf-text-muted);
  --tfs-select: #ffffff;
  --tfs-playhead: var(--tf-accent);
  --tfs-range: rgb(3 191 255 / 14%);
}
.window-hint {
  margin: 0;
  padding: 12px 16px;
  border-top: 1px solid var(--tf-border);
  color: var(--tf-text-subtle);
  font-size: 13px;
}

.features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 96px 0 0;
}
.feature {
  padding: 24px;
  border: 1px solid var(--tf-border);
  border-radius: 16px;
  background: linear-gradient(180deg, var(--tf-surface-1), var(--tf-bg));
}
.feature svg {
  width: 36px;
  height: 36px;
  padding: 7px;
  border-radius: 10px;
  background: rgb(3 191 255 / 12%);
  fill: none;
  stroke: var(--tf-primary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.feature h3 {
  margin: 18px 0 8px;
  font-size: 17px;
  font-weight: 700;
}
.feature p {
  margin: 0;
  color: var(--tf-text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.eyebrow {
  color: var(--tf-primary);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.landing h2 {
  margin: 12px 0 0;
  border: 0;
  padding: 0;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.12;
  font-weight: 800;
  letter-spacing: -0.025em;
}

.split {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 48px;
  align-items: center;
  padding: 112px 0 0;
}
.split-copy p {
  margin: 16px 0 0;
  color: var(--tf-text-muted);
  font-size: 16px;
  line-height: 1.65;
}
.link {
  display: inline-block;
  margin-top: 20px;
  color: var(--tf-primary) !important;
  font-weight: 600;
}
.code {
  margin: 0;
  padding: 24px;
  border: 1px solid var(--tf-border);
  border-radius: 16px;
  background: var(--tf-surface-1);
  overflow-x: auto;
  font: 13.5px/1.7 ui-monospace, 'SF Mono', Menlo, monospace;
  color: var(--tf-text);
}
.code .k { color: var(--tf-secondary); }
.code .s { color: var(--tf-success); }
.code .f { color: var(--tf-primary); }
.code .n { color: var(--tf-warning); }

.uses {
  padding: 112px 0 0;
  text-align: center;
}
.uses ul {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}
.uses li {
  padding: 10px 18px;
  border: 1px solid var(--tf-border);
  border-radius: 999px;
  background: var(--tf-surface-1);
  color: var(--tf-text-muted);
  font-size: 15px;
}

.roadmap {
  padding: 112px 0 0;
}
.roadmap ol {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin: 32px 0 0;
  padding: 0;
  list-style: none;
}
.roadmap li {
  padding: 24px;
  border: 1px solid var(--tf-border);
  border-radius: 16px;
  background: var(--tf-surface-1);
}
.stage {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--tf-surface-3);
  color: var(--tf-text-muted);
  font-size: 12px;
  font-weight: 700;
}
.stage-available .stage {
  background: rgb(47 208 127 / 14%);
  color: var(--tf-success);
}
.stage-next .stage {
  background: rgb(3 191 255 / 14%);
  color: var(--tf-primary);
}
.roadmap h3 {
  margin: 14px 0 6px;
  font-size: 17px;
}
.roadmap p {
  margin: 0;
  color: var(--tf-text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.cta {
  margin-top: 112px !important;
  padding: 64px 24px;
  border: 1px solid var(--tf-border-strong);
  border-radius: 24px;
  text-align: center;
  background:
    radial-gradient(60% 120% at 50% 0%, rgb(3 191 255 / 16%), transparent 70%),
    var(--tf-surface-1);
}
.cta .actions {
  margin-top: 28px;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  padding: 48px 0;
  color: var(--tf-text-subtle);
  font-size: 13px;
}
.foot a {
  margin-left: 20px;
}
.foot a:hover {
  color: var(--tf-text);
}

@media (max-width: 900px) {
  .features { grid-template-columns: repeat(2, 1fr); }
  .split { grid-template-columns: 1fr; gap: 32px; }
  .roadmap ol { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .landing { padding: 0 16px; }
  .topnav { gap: 14px; font-size: 13px; }
  .topnav a:nth-child(2) { display: none; }
  .hero { padding-top: 40px; }
  .features { grid-template-columns: 1fr; padding-top: 64px; }
  .window-body { height: 320px; }
  .split, .uses, .roadmap { padding-top: 72px; }
  .foot a { margin: 0 16px 0 0; }
}
</style>
