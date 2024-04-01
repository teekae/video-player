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

	// Calculate the size of each frame
	frameSize := 480 * 270 * 2 // 480x270 pixels, 2 bytes per pixel

	// Create a buffer to hold each frame
	buf := make([]byte, frameSize)

	// Create a slice to hold the frames
	frames := make([]Frame, 0)

	// Read the output directly into frames
	for {
		// Read a frame's worth of data into buf
		n, err := io.ReadFull(pipe, buf)
		if err == io.EOF {
			// We've reached the end of the file, so we're done
			break
		} else if err != nil {
			// An error occurred, so return it
			return nil, err
		}

		// Create a new Frame and append it to frames
		frame := Frame{
			YUVData:     append([]byte(nil), buf[:n]...),
			Width:       480,
			Height:      270,
			FrameNumber: len(frames),
		}
		frames = append(frames, frame)
	}

	// Wait for the command to finish
	if err := cmd.Wait(); err != nil {
		return nil, err
	}

	return frames, nil
}
