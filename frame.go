package main

import (
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"os"
	"os/exec"
)

type Frame struct {
	YUVData     []byte `json:"yuvData"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	FrameNumber int    `json:"frameNumber"`
}

type videoMetadata struct {
	Streams []struct {
		Width     int     `json:"width"`
		Height    int     `json:"height"`
		Codec     string  `json:"codec_name"`
		FrameRate big.Rat `json:"r_frame_rate"`
	} `json:"streams"`
}

func getMetadata(videoPath string) (videoMetadata, error) {
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-show_streams",
		"-select_streams", "v",
		"-show_format",
		"-print_format", "json",
		videoPath,
	)

	cmd.Stderr = os.Stderr

	output, err := cmd.Output()
	if err != nil {
		return videoMetadata{}, fmt.Errorf("failed to get metadata: %w", err)
	}

	var metadata videoMetadata
	if err := json.Unmarshal(output, &metadata); err != nil {
		return videoMetadata{}, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return metadata, nil
}

func loadFrames(videoPath string) ([]Frame, error) {

	metadata, err := getMetadata(videoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get metadata: %w", err)
	}

	if len(metadata.Streams) == 0 {
		return nil, fmt.Errorf("no video streams found")
	}

	file, err := os.Open(videoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open video file %w", err)
	}
	defer file.Close()

	cmd := exec.Command("ffmpeg",
		"-hide_banner",
		"-loglevel", "error",
		"-i", "pipe:0",
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

	stream := metadata.Streams[0]

	// Calculate the size of each frame
	frameSize := stream.Width * stream.Height * 2 // YUV422 so 2 bytes per pixel

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
			Width:       stream.Width,
			Height:      stream.Height,
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
