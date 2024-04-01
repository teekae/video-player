import wailsLogo from "./assets/wails.png";
import "./App.css";
import { VideoPlayer } from "./VideoPlayer";

function App() {
  return (
    <div className="min-h-screen bg-white grid grid-cols-1 place-items-center justify-items-center mx-auto py-8">
      <div className="w-fit max-w-md">
        <VideoPlayer />
      </div>
    </div>
  );
}

export default App;
