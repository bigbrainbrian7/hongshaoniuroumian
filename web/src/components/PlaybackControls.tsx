type PlaybackControlsProps = {
  isPlaying: boolean;
  onToggle: () => void;
  onReset: () => void;
};

export function PlaybackControls({
  isPlaying,
  onToggle,
  onReset,
}: PlaybackControlsProps) {
  return (
    <div className="controls">
      <button onClick={onToggle}>{isPlaying ? "Pause" : "Play"}</button>
      <button className="secondary" onClick={onReset}>Reset</button>
    </div>
  );
}
