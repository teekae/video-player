import { useEffect, useRef, useState } from "react";
import useWebSocket from "react-use-websocket";
import { GL, createProgram, initGL } from "./gl";

const webSocketUrl = "http://localhost:8080/websocket";

type Frame = {
  yuvData: string;
  width: number;
  height: number;
  frameNumber: number;
  totalFrames: number;
};

export const VideoPlayer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { lastMessage, sendJsonMessage } = useWebSocket(webSocketUrl);

  const [glInit, setGlInit] = useState(false);

  const glRef = useRef<WebGLRenderingContext | null>(null);

  const myGLRef = useRef<GL | null>(null);

  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!lastMessage) {
      console.log("No message received");
      return;
    }

    const frame = JSON.parse(lastMessage.data) as Frame;

    if (!canvasRef.current) {
      console.log("No canvas");
      return;
    }

    if (!glInit && canvasRef.current) {
      console.log("Initializing GL");
      const canvas = canvasRef.current;
      glRef.current = initGL(canvas);

      const myGL = createProgram(glRef.current);
      glRef.current.useProgram(myGL.program);
      setGlInit(true);

      myGLRef.current = myGL;
    }

    const gl = glRef.current;
    if (!gl) {
      console.log("No gl");
      return;
    }

    const myGL = myGLRef.current;
    if (!myGL) {
      console.log("No myGL");
      return;
    }

    const width = frame.width;
    const height = frame.height;

    const ySize = width * height;
    const uSize = (width * height) / 2;
    const vSize = (width * height) / 2;

    console.table({ ySize, uSize, vSize });

    const binaryString = atob(frame.yuvData);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload the YUV data to the textures
    const yData = new Uint8Array(bytes.slice(0, ySize));
    const uData = new Uint8Array(bytes.slice(ySize, ySize + uSize));
    const vData = new Uint8Array(
      bytes.slice(ySize + uSize, ySize + uSize + vSize)
    );

    const { yTexture, uTexture, vTexture } = myGL;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, yTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      width,
      height,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      yData
    );

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, uTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      width / 2,
      height,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      uData
    );

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, vTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      width / 2,
      height,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      vData
    );

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    console.log("Frame drawn");
    // check gl error
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.error("GL error", error);
    }
  }, [lastMessage]);

  const requestFrame = () => {
    sendJsonMessage({
      type: "request-frame",
      payload: {
        frame: frame,
      },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas ref={canvasRef} width={480} height={270}></canvas>
      <div className="flex gap-2">
        <input
          className="w-16"
          type="number"
          min={0}
          max={480}
          step={1}
          value={frame}
          onChange={(e) => setFrame(Number(e.target.value))}
        />
        <button
          className="bg-slate-900 text-neutral-200 p-4 rounded"
          onClick={requestFrame}
        >
          Click me
        </button>
      </div>
    </div>
  );
};
