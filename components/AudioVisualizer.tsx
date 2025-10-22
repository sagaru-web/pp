import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream;
  isRecording: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording || !stream || !canvasRef.current || stream.getAudioTracks().length === 0 || !stream.active) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyser);
    analyser.fftSize = 256;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    
    if (!canvasCtx) return;

    const draw = () => {
      animationFrameId.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      
      const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
      // Scale the radius: add a base size and make the pulse more noticeable.
      const pulsingRadius = 5 + (average / 256) * 15;

      // Use the primary color from tailwind config
      const primaryColor = document.documentElement.classList.contains('dark') 
        ? 'hsl(217, 91%, 60%)' 
        : 'hsl(217, 91%, 60%)';

      canvasCtx.fillStyle = primaryColor;
      canvasCtx.beginPath();
      canvasCtx.arc(canvas.width / 2, canvas.height / 2, pulsingRadius, 0, 2 * Math.PI);
      canvasCtx.fill();
    };

    draw();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      source.disconnect();
      analyser.disconnect();
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [isRecording, stream]);

  return <canvas ref={canvasRef} width="100" height="50" className="mx-auto" />;
};

export default AudioVisualizer;