package main

import (
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"os/exec"
)

type videoMetadata struct {
	Streams []struct {
		Width     int     `json:"width"`
		Height    int     `json:"height"`
		Codec     string  `json:"codec_name"`
		FrameRate big.Rat `json:"r_frame_rate"`
	} `json:"streams"`
}

func loadVideoMetadata(videoPath string) (videoMetadata, error) {
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
