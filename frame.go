package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
)

type Frame struct {
	YUVData     []byte `json:"yuvData"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	FrameNumber int    `json:"frameNumber"`
}

func loadFrames(videoPath string) ([]Frame, error) {
	file, err := os.Open(videoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open video file %w", err)
	}
	defer file.Close()

	cmd := exec.Command("ffmpeg",
		"-hide_banner",
		"-loglevel", "error",
		"-i", "pipe:0",
		"-vf", "scale=480:270",
		"-f", "rawvideo",
		"-pix_fmt", "yuv422p",
		"pipe:1",
	)
	cmd.Stdin = file
	cmd.Stderr = os.Stderr

	// Create a pipe to read the output of the command
	pipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	// Read the output into a byte array
	output, err := io.ReadAll(pipe)
	if err != nil {
		return nil, err
	}

	// Wait for the command to finish
	if err := cmd.Wait(); err != nil {
		return nil, err
	}

	// Calculate the size of each frame
	frameSize := 480 * 270 * 2 // yuv420p uses 1.5 bytes per pixel

	// Split the output into frames
	frames := make([]Frame, 0)
	for i := 0; i < len(output); i += frameSize {
		frame := Frame{
			YUVData:     output[i : i+frameSize],
			Width:       480,
			Height:      270,
			FrameNumber: i,
		}
		frames = append(frames, frame)
	}

	return frames, nil
}
