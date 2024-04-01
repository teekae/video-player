import { Frame } from "./frame";

export type GL = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  yTexture: WebGLTexture;
  uTexture: WebGLTexture;
  vTexture: WebGLTexture;
};

export const initGL = (canvas: HTMLCanvasElement): GL => {
  const gl = canvas.getContext("webgl");
  if (!gl) {
    throw new Error("No webgl");
  }

  return createProgram(gl);
};

const createVertexShader = (gl: WebGLRenderingContext): WebGLShader => {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  if (!vertexShader) {
    throw new Error("Error creating vertex shader");
  }
  gl.shaderSource(
    vertexShader,
    `
        attribute vec2 position;
        varying vec2 vUv;
        void main() {
        vUv = position;
        vUv.x = 1.0 - vUv.x;

        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
        }
    `
  );
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    throw new Error("Error compiling vertex shader");
  }
  return vertexShader;
};

const createFragmentShader = (gl: WebGLRenderingContext): WebGLShader => {
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!fragmentShader) {
    throw new Error("Error creating fragment shader");
  }
  gl.shaderSource(
    fragmentShader,
    `
        precision highp float;
        uniform sampler2D yTexture;
        uniform sampler2D uTexture;
        uniform sampler2D vTexture;
        varying vec2 vUv;

        void main() {
          float y = texture2D(yTexture, vUv).r;
          float u = texture2D(uTexture, vUv).r;
          float v = texture2D(vTexture, vUv).r;

          // convert yuv to rgb
          float r = y + 1.402 * (v - 0.5);
          float g = y - 0.344136 * (u - 0.5) - 0.714136 * (v - 0.5);
          float b = y + 1.772 * (u - 0.5);

          gl_FragColor = vec4(r, g, b, 1.0);
        }
        `
  );
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(fragmentShader));
    throw new Error("Error compiling fragment shader");
  }
  return fragmentShader;
};

const createTexture = (
  gl: WebGLRenderingContext,
  index: number
): WebGLTexture => {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Error creating texture");
  }

  gl.activeTexture(gl.TEXTURE0 + index);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return texture;
};

const createProgram = (gl: WebGLRenderingContext): GL => {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Error creating program");
  }
  const vertexShader = createVertexShader(gl);
  const fragmentShader = createFragmentShader(gl);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Error linking program");
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [
    -1.0,
    -1.0, // First triangle
    1.0,
    -1.0,
    -1.0,
    1.0,
    1.0,
    -1.0, // Second triangle
    -1.0,
    1.0,
    1.0,
    1.0,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const yTexture = createTexture(gl, 0);
  const uTexture = createTexture(gl, 1);
  const vTexture = createTexture(gl, 2);
  // Get the locations of the uniform variables in the shader program
  const yLocation = gl.getUniformLocation(program, "yTexture");
  const uLocation = gl.getUniformLocation(program, "uTexture");
  const vLocation = gl.getUniformLocation(program, "vTexture");

  // Set the uniform variables to the indices of the texture units
  gl.uniform1i(yLocation, 0); // texture unit 0
  gl.uniform1i(uLocation, 1); // texture unit 1
  gl.uniform1i(vLocation, 2); // texture unit 2

  // Create textures for the Y, U, and V components
  return {
    gl,
    program,
    yTexture,
    uTexture,
    vTexture,
  };
};

export const updateTextures = (wgl: GL, frame: Frame): void => {
  const width = frame.width;
  const height = frame.height;

  const ySize = width * height;
  const uSize = (width * height) / 2;
  const vSize = (width * height) / 2;

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

  const { gl, yTexture, uTexture, vTexture } = wgl;

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
};
