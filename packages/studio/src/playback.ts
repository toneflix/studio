import type { AudioEngine } from '@toneflix/studio-audio';
import type { StudioTimeline } from '@toneflix/studio-timeline';

export interface LinkPlaybackOptions {
  /** Space plays and pauses while the timeline has focus */
  space?: boolean;
}

/**
 * Keeps an engine and a timeline together: finished edits play at once, clicking the
 * ruler seeks, and the playhead follows playback. Returns a function that unlinks them.
 */
export const linkPlayback = (timeline: StudioTimeline, engine: AudioEngine, options: LinkPlaybackOptions = {}) => {
  let frame = 0;

  const follow = () => {
    timeline.setTime(engine.time);
    frame = engine.isPlaying ? requestAnimationFrame(follow) : 0;
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== ' ' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName))) return;

    e.preventDefault();
    engine.toggle();
  };

  engine.load(timeline.state);
  timeline.setLoop(engine.loop);

  const unlink = [
    timeline.on('change', ({ state, final }) => final && engine.load(state)),
    timeline.on('seek', ({ time }) => engine.seek(time)),
    engine.on('play', () => {
      cancelAnimationFrame(frame);
      follow();
    }),
    engine.on('pause', ({ time }) => timeline.setTime(time)),
    engine.on('seek', ({ time }) => timeline.setTime(time)),
    engine.on('end', ({ time }) => timeline.setTime(time)),
    engine.on('loop', ({ loop }) => timeline.setLoop(loop)),
  ];

  if (options.space ?? true) timeline.root.addEventListener('keydown', onKey);

  return () => {
    cancelAnimationFrame(frame);
    for (const off of unlink) off();
    timeline.root.removeEventListener('keydown', onKey);
  };
};
