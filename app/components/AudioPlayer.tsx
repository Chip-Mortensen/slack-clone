import { useState, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  url: string;
}

export default function AudioPlayer({ url }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  return (
    <>
      <button
        onClick={togglePlay}
        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause size={16} className="text-blue-600" />
        ) : (
          <Play size={16} className="text-blue-600" />
        )}
      </button>
      <audio
        ref={audioRef}
        src={url}
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />
    </>
  );
} 