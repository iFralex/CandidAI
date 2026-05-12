import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SUBTITLE_STYLES = {
    "bold_yellow": {
        "Fontname": "Arial",
        "Fontsize": "18",
        "Bold": "-1",
        "PrimaryColour": "&H0000FFFF",
        "OutlineColour": "&H00000000",
        "BackColour": "&H00000000",
        "Outline": "2",
        "Shadow": "1",
        "Alignment": "2",
        "MarginV": "30",
        "BorderStyle": "1",
    },
    "minimal_white": {
        "Fontname": "Helvetica Neue",
        "Fontsize": "14",
        "Bold": "0",
        "PrimaryColour": "&H00FFFFFF",
        "OutlineColour": "&H80000000",
        "BackColour": "&H00000000",
        "Outline": "1",
        "Shadow": "0",
        "Alignment": "2",
        "MarginV": "20",
        "BorderStyle": "1",
    },
    "dark_band": {
        "Fontname": "Arial",
        "Fontsize": "16",
        "Bold": "0",
        "PrimaryColour": "&H00FFFFFF",
        "OutlineColour": "&H00000000",
        "BackColour": "&HAA000000",
        "Outline": "0",
        "Shadow": "0",
        "Alignment": "2",
        "MarginV": "25",
        "BorderStyle": "3",
    },
    "outlined_color": {
        "Fontname": "Arial",
        "Fontsize": "17",
        "Bold": "-1",
        "PrimaryColour": "&H00EA5C6A",
        "OutlineColour": "&H00FFFFFF",
        "BackColour": "&H00000000",
        "Outline": "2",
        "Shadow": "0",
        "Alignment": "2",
        "MarginV": "30",
        "BorderStyle": "1",
    },
    "word_pop": {
        "Fontname": "Arial",
        "Fontsize": "18",
        "Bold": "-1",
        "PrimaryColour": "&H0000FFFF",
        "OutlineColour": "&H00000000",
        "BackColour": "&H00000000",
        "Outline": "2",
        "Shadow": "1",
        "Alignment": "2",
        "MarginV": "30",
        "BorderStyle": "1",
    },
}

_model = None


def _load_model():
    global _model
    if _model is None:
        import whisper
        logger.info("Loading Whisper large-v3 model (first time, may take a minute)...")
        _model = whisper.load_model("large-v3")
        logger.info("Whisper model loaded.")
    return _model


class SubtitleGenerator:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self.subtitle_dir = os.path.join(storage_path, "subtitles")
        os.makedirs(self.subtitle_dir, exist_ok=True)

    def transcribe(self, video_path: str) -> dict:
        """Run Whisper large-v3 transcription. Caches result as JSON."""
        cache_path = os.path.join(
            self.subtitle_dir,
            os.path.splitext(os.path.basename(video_path))[0] + ".json"
        )
        if os.path.exists(cache_path):
            import json
            with open(cache_path) as f:
                return json.load(f)
        model = _load_model()
        result = model.transcribe(video_path, language="en", word_timestamps=True)
        import json
        with open(cache_path, "w") as f:
            json.dump(result, f)
        logger.info(f"Transcribed {video_path} -> {len(result['segments'])} segments")
        return result

    def generate_subtitle_file(self, video_path: str, style_name: str, output_id: str) -> str:
        """Generate an ASS subtitle file. Returns the path."""
        result = self.transcribe(video_path)
        output_path = os.path.join(self.subtitle_dir, f"{output_id}_{style_name}.ass")
        if style_name == "word_pop":
            content = self._build_word_pop_ass(result, style_name)
        else:
            content = self._build_standard_ass(result, style_name)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        return output_path

    def _build_standard_ass(self, result: dict, style_name: str) -> str:
        header = self._make_ass_header(style_name)
        lines = ["[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
        for seg in result["segments"]:
            start = self._seconds_to_ass_time(seg["start"])
            end = self._seconds_to_ass_time(seg["end"])
            text = seg["text"].strip().replace("\n", " ")
            lines.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")
        return header + "\n".join(lines)

    def _build_word_pop_ass(self, result: dict, style_name: str) -> str:
        header = self._make_ass_header(style_name)
        lines = ["[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
        for seg in result["segments"]:
            words = seg.get("words", [])
            if not words:
                start = self._seconds_to_ass_time(seg["start"])
                end = self._seconds_to_ass_time(seg["end"])
                text = seg["text"].strip()
                lines.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")
                continue
            seg_start = self._seconds_to_ass_time(words[0]["start"])
            seg_end = self._seconds_to_ass_time(words[-1]["end"])
            tagged_words = []
            for word in words:
                duration_cs = int((word["end"] - word["start"]) * 100)
                w = word["word"].strip()
                tagged_words.append(f"{{\\kf{duration_cs}}}{w}")
            text = " ".join(tagged_words)
            lines.append(f"Dialogue: 0,{seg_start},{seg_end},Default,,0,0,0,,{text}")
        return header + "\n".join(lines)

    def _make_ass_header(self, style_name: str) -> str:
        s = SUBTITLE_STYLES[style_name]
        return f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{s['Fontname']},{s['Fontsize']},{s['PrimaryColour']},&H000000FF,{s['OutlineColour']},{s['BackColour']},{s['Bold']},0,0,0,100,100,0,0,{s['BorderStyle']},{s['Outline']},{s['Shadow']},{s['Alignment']},10,10,{s['MarginV']},1

"""

    def _result_to_srt(self, result: dict) -> str:
        lines = []
        for i, seg in enumerate(result["segments"], 1):
            start = self._seconds_to_srt_time(seg["start"])
            end = self._seconds_to_srt_time(seg["end"])
            lines.append(f"{i}\n{start} --> {end}\n{seg['text'].strip()}\n")
        return "\n".join(lines)

    def _seconds_to_ass_time(self, seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = seconds % 60
        return f"{h}:{m:02d}:{s:05.2f}"

    def _seconds_to_srt_time(self, seconds: float) -> str:
        ms = int((seconds % 1) * 1000)
        s = int(seconds) % 60
        m = int(seconds // 60) % 60
        h = int(seconds // 3600)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
