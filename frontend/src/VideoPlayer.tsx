import { useEffect, useRef, useState } from "react";
import useWebSocket from "react-use-websocket";
import { GL, initGL, updateTextures } from "./gl";
import { Frame } from "./frame";
import { ProgressBar } from "./ProgressBar";
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-col relative">
        <canvas ref={canvasRef} width={480} height={270}></canvas>
        <span className="absolute top-0 right-0 bg-slate-900/80 p-1 text-neutral-200">
          {frame}/{metadata.frameCount}
        </span>
        <progress
          className="[&::-webkit-progress-bar]:bg-black/30
        [&::-webkit-progress-value]:bg-red-500
        [&::-moz-progress-bar]:bg-red-500
         w-full absolute bottom-0"
          value={frame}
          max={metadata.frameCount}
        />
      </div>

      <div className="flex gap-2">
        <button
          className="bg-slate-900 text-neutral-200 p-4 rounded-full"
          onClick={playPause}
          disabled={metadata.frameCount === 0}
        >
          {playing ? <Pause /> : <Play />}
        </button>
        <button
          className="bg-slate-900 text-neutral-200 p-4 rounded-full"
          onClick={stop}
        >
          <Stop />
        </button>
      </div>
    </div>
  );
};
