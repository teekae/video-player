import { useEffect, useRef, useState } from "react";
import useWebSocket from "react-use-websocket";
import { GL, initGL, updateTextures } from "./gl";
import { Frame } from "./frame";
import { Pause, Play, Stop } from "@phosphor-icons/react";

const webSocketUrl = "http://localhost:8080/websocket";

type Message = {
  type: string;
  payload: any;
};

type Metadata = {
  frameCount: number;
};

export const VideoPlayer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { lastMessage, sendJsonMessage } = useWebSocket(webSocketUrl);

  const glRef = useRef<GL | null>(null);

  const [frame, setFrame] = useState(0);

  const [playing, setPlaying] = useState(false);

  const [metadata, setMetadata] = useState<Metadata>({} as Metadata);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!playing) {
        return;
      }

      if (frame >= metadata.frameCount) {
        setPlaying(false);
        return;
      }

      setFrame(frame + 1);
    }, 32);

    return () => {
      clearInterval(interval);
    };
  }, [frame, metadata.frameCount, playing]);

  useEffect(() => {
    requestFrame(frame);
  }, [frame]);

  const renderFrame = (frame: Frame) => {
    if (!canvasRef.current) {
      return;
    }

    if (!glRef.current) {
      console.log("Initializing GL");
      const canvas = canvasRef.current;
      glRef.current = initGL(canvas);
    }

    const wgl = glRef.current;
    if (!wgl) {
      console.log("No gl");
      return;
    }

    const { gl } = wgl;

    updateTextures(wgl, frame);

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  useEffect(() => {
    if (!lastMessage) {
      return;
    }

    const message = JSON.parse(lastMessage.data) as Message;

    if (message.type === "frame") {
      const frame = message.payload as Frame;
      renderFrame(frame);
    } else if (message.type === "metadata") {
      const metadata = message.payload as Metadata;
      console.log("metadata", metadata);
      setMetadata(metadata);
    }
  }, [lastMessage]);

  const requestFrame = (frameNumber: number) => {
    sendJsonMessage({
      type: "request-frame",
      payload: {
        frame: frameNumber,
      },
    });
  };

  const playPause = () => {
    if (frame >= metadata.frameCount) {
      setFrame(0);
    }
    setPlaying(!playing);
  };

  const stop = () => {
    setFrame(0);
    setPlaying(false);
  };

  return (
    <div className="relative flex flex-col">
      <canvas ref={canvasRef} width={480} height={270}></canvas>
      <span className="absolute top-0 right-0 bg-slate-900/60 p-1 text-neutral-200">
        {frame}/{metadata.frameCount}
      </span>
      <Controls
        playPause={playPause}
        stop={stop}
        playing={playing}
        frameCount={metadata.frameCount}
        frame={frame}
      />
    </div>
  );
};

export const Controls = ({
  playPause,
  stop,
  playing,
  frameCount,
  frame,
}: {
  playPause: () => void;
  stop: () => void;
  playing: boolean;
  frameCount: number;
  frame: number;
}) => {
  return (
    <div className="absolute bottom-0 w-full text-white">
      <div className="flex flex-col">
        <progress
          className="h-1 w-full
        [&::-webkit-progress-bar]:bg-black/30
        [&::-webkit-progress-value]:bg-red-500
        [&::-moz-progress-bar]:bg-red-500"
          value={frame}
          max={frameCount}
        />
        <div>
          <button
            className="p-2"
            onClick={playPause}
            disabled={frameCount === 0}
          >
            {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
          </button>
          <button className="p-2" onClick={stop}>
            <Stop weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
};
