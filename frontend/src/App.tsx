import { VideoPlayer } from "./VideoPlayer";

function App() {
  return (
    <div className="mx-auto grid min-h-screen grid-cols-1 place-items-center justify-items-center bg-white py-8">
      <div className="w-fit max-w-md">
        <VideoPlayer />
      </div>
    </div>
  );
}

export default App;
