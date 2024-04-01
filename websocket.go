package main

import (
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{}

func serveWs(frames []Frame) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {

		upgrader.CheckOrigin = func(r *http.Request) bool { return true }
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("upgrade:", err)
			return
		}

		defer ws.Close()

		err = websocketServer(ws, frames, r.Context())
		if err != nil {
			log.Println(err)
		}
	}
}

type SendFrame struct {
	Frame
	FrameNumber int `json:"frameNumber"`
	TotalFrames int `json:"totalFrames"`
}

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type RequestFrame struct {
	Frame int `json:"frame"`
}

func sendFrame(ws *websocket.Conn, frames []Frame, frameNumber int) error {
	if frameNumber >= len(frames) {
		return fmt.Errorf("Frame number %d out of range %d", frameNumber, len(frames))
	}
	err := ws.WriteJSON(SendFrame{frames[frameNumber],
		frameNumber,
		len(frames)})
	if err != nil {
		log.Println("write:", err)
		return err
	}
	return nil
}

// websocketServer is called for every new inbound WebSocket
func websocketServer(ws *websocket.Conn, frames []Frame, ctx context.Context) error {
	err := sendFrame(ws, frames, 0)
	if err != nil {
		return err
	}

	for {
		select {
		case <-ctx.Done():
			log.Println("context done")
			return nil
		default:

			var msg Message
			err := ws.ReadJSON(&msg)
			if err != nil {
				log.Println("read:", err)
				continue
			}
			if msg.Type == "request-frame" {
				var reqFrame RequestFrame
				err := json.Unmarshal(msg.Payload, &reqFrame)
				if err != nil {
					log.Println("unmarshal:", err)
					continue
				}

				sendFrame(ws, frames, reqFrame.Frame)
				continue
			}

			log.Println("Unknown message:", msg)
		}

	}
}

func writeFrameToFile(frame Frame) {

	f, err := os.Create("frame.png")
	if err != nil {
		log.Fatal(err)
	}

	defer f.Close()

	im := image.NewYCbCr(image.Rect(0, 0, frame.Width, frame.Height), image.YCbCrSubsampleRatio422)

	im.Y = frame.YUVData[:frame.Width*frame.Height]
	im.Cb = frame.YUVData[frame.Width*frame.Height : frame.Width*frame.Height+(frame.Width*frame.Height/2)]
	im.Cr = frame.YUVData[frame.Width*frame.Height+(frame.Width*frame.Height/2):]

	err = png.Encode(f, im)

	if err != nil {
		log.Fatal(err)
	}

	log.Println("Frame written to file")

}
