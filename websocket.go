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

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type RequestFrame struct {
	Frame int `json:"frame"`
}

type Metadata struct {
	FrameCount int `json:"frameCount"`
}

func sendFrame(ws *websocket.Conn, frames []Frame, frameNumber int) error {
	if frameNumber >= len(frames) {
		return fmt.Errorf("Frame number %d out of range %d", frameNumber, len(frames))
	}

	payload, err := json.Marshal(frames[frameNumber])
	if err != nil {
		return fmt.Errorf("Failed to marshal frame %d: %w", frameNumber, err)
	}

	err = ws.WriteJSON(Message{
		Type:    "frame",
		Payload: payload})
	if err != nil {
		return fmt.Errorf("Failed to send frame %d: %w", frameNumber, err)
	}
	return nil
}

// websocketServer is called for every new inbound WebSocket
func websocketServer(ws *websocket.Conn, frames []Frame, ctx context.Context) error {

	// Send metadata
	payload, err := json.Marshal(Metadata{FrameCount: len(frames)})
	if err != nil {
		return fmt.Errorf("Failed to marshal metadata: %w", err)
	}
	err = ws.WriteJSON(Message{
		Type:    "metadata",
		Payload: payload})

	if err != nil {
		return fmt.Errorf("Failed to send metadata: %w", err)
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
				return fmt.Errorf("Failed to read message: %w", err)
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
