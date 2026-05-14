import os
import logging

logger = logging.getLogger(__name__)

# Words shown per subtitle event (all styles). Override via env var.
WORDS_PER_CHUNK = int(os.environ.get("SUBTITLE_WORDS_PER_CHUNK", "3"))

# ASS colours: &HAABBGGRR  (AA=00 → opaque, FF → transparent)
SUBTITLE_STYLES = {
    "bold_yellow": {
        "Fontname": "DejaVu Sans",
        "Fontsize": "80",
        "Bold": "-1",
        "PrimaryColour": "&H0000FFFF",    # yellow
        "SecondaryColour": "&H00FFFFFF",  # white
        "OutlineColour": "&H00000000",    # black
        "BackColour": "&H00000000",
        "Outline": "3",
        "Shadow": "1",
        "Alignment": "2",
        "MarginV": "30",
        "BorderStyle": "1",
    },
    "minimal_white": {
        "Fontname": "DejaVu Sans",
        "Fontsize": "72",
        "Bold": "-1",
        "PrimaryColour": "&H00FFFFFF",
        "SecondaryColour": "&H00AAAAAA",  # grey
        "OutlineColour": "&H00000000",
        "BackColour": "&H00000000",
        "Outline": "3",
        "Shadow": "2",
        "Alignment": "2",
        "MarginV": "30",
        "BorderStyle": "1",
    },
    "dark_band": {
        "Fontname": "DejaVu Sans",
        "Fontsize": "70",
        "Bold": "-1",
        "PrimaryColour": "&H00FFFFFF",
        "SecondaryColour": "&H00CCCCCC",
        "OutlineColour": "&H00000000",
        "BackColour": "&H80000000",       # 50% opaque black band
        "Outline": "0",
        "Shadow": "0",
        "Alignment": "2",
        "MarginV": "30",
        "BorderStyle": "3",              # opaque box
    },
    "outlined_color": {
        "Fontname": "DejaVu Sans",
        "Fontsize": "78",
        "Bold": "-1",
        "PrimaryColour": "&H002BFFD4",    # mint/cyan
        "SecondaryColour": "&H00FFFFFF",
        "OutlineColour": "&H00000000",
        "BackColour": "&H00000000",
        "Outline": "3",
        "Shadow": "1",
        "Alignment": "2",
        "MarginV": "30",
        "BorderStyle": "1",
    },
    # Karaoke style: current word turns yellow, others stay white.
    # Uses stable-ts word timestamps for accurate per-word timing.
    "word_pop": {
        "Fontname": "DejaVu Sans",
        "Fontsize": "80",
        "Bold": "-1",
        "PrimaryColour": "&H0000FFFF",    # yellow: word being spoken
        "SecondaryColour": "&H00FFFFFF",  # white: words not yet spoken
        "OutlineColour": "&H00000000",
        "BackColour": "&H00000000",
        "Outline": "3",
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
        import stable_whisper
        model_name = os.environ.get("WHISPER_MODEL", "small")
        logger.info(f"Loading stable-whisper {model_name} model...")
        _model = stable_whisper.load_model(model_name)
        logger.info("stable-whisper model loaded.")
    return _model


class SubtitleGenerator:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self.subtitle_dir = os.path.join(storage_path, "subtitles")
        os.makedirs(self.subtitle_dir, exist_ok=True)

    def transcribe(self, video_path: str) -> dict:
        """Transcribe with stable-whisper; cache result as JSON."""
        cache_path = os.path.join(
            self.subtitle_dir,
            os.path.splitext(os.path.basename(video_path))[0] + ".json"
        )
        if os.path.exists(cache_path):
            import json
            with open(cache_path) as f:
                return json.load(f)
        model = _load_model()
        lang = os.environ.get("WHISPER_LANGUAGE") or None
        result = model.transcribe(video_path, language=lang, word_timestamps=True)
        result = result.to_dict()
        import json
        with open(cache_path, "w") as f:
            json.dump(result, f)
        logger.info(f"Transcribed {video_path} → {len(result['segments'])} segments")
        return result

    def generate_subtitle_file(self, video_path: str, style_name: str, output_id: str) -> str:
        """Generate an ASS subtitle file; returns its path."""
        result = self.transcribe(video_path)
        output_path = os.path.join(self.subtitle_dir, f"{output_id}_{style_name}.ass")
        if style_name == "word_pop":
            content = self._build_word_pop_ass(result, style_name)
        else:
            content = self._build_chunked_ass(result, style_name)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        return output_path

    def _build_chunked_ass(self, result: dict, style_name: str) -> str:
        """WORDS_PER_CHUNK words per event — short, punchy TikTok-style captions."""
        header = self._make_ass_header(style_name)
        lines = [
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
        ]
        for seg in result["segments"]:
            words = seg.get("words", [])
            if not words:
                s = self._seconds_to_ass_time(seg["start"])
                e = self._seconds_to_ass_time(seg["end"])
                lines.append(f"Dialogue: 0,{s},{e},Default,,0,0,0,,{seg['text'].strip()}")
                continue
            for i in range(0, len(words), WORDS_PER_CHUNK):
                chunk = words[i:i + WORDS_PER_CHUNK]
                s = self._seconds_to_ass_time(chunk[0]["start"])
                e = self._seconds_to_ass_time(chunk[-1]["end"])
                text = " ".join(w["word"].strip() for w in chunk)
                lines.append(f"Dialogue: 0,{s},{e},Default,,0,0,0,,{text}")
        return header + "\n".join(lines)

    def _build_word_pop_ass(self, result: dict, style_name: str) -> str:
        """WORDS_PER_CHUNK words per event with \\kf karaoke: current word goes yellow."""
        header = self._make_ass_header(style_name)
        lines = [
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
        ]
        for seg in result["segments"]:
            words = seg.get("words", [])
            if not words:
                s = self._seconds_to_ass_time(seg["start"])
                e = self._seconds_to_ass_time(seg["end"])
                lines.append(f"Dialogue: 0,{s},{e},Default,,0,0,0,,{seg['text'].strip()}")
                continue
            for i in range(0, len(words), WORDS_PER_CHUNK):
                chunk = words[i:i + WORDS_PER_CHUNK]
                s = self._seconds_to_ass_time(chunk[0]["start"])
                e = self._seconds_to_ass_time(chunk[-1]["end"])
                tagged = []
                for word in chunk:
                    dur_cs = int((word["end"] - word["start"]) * 100)
                    tagged.append(f"{{\\kf{dur_cs}}}{word['word'].strip()}")
                lines.append(f"Dialogue: 0,{s},{e},Default,,0,0,0,,{' '.join(tagged)}")
        return header + "\n".join(lines)

    def _make_ass_header(self, style_name: str) -> str:
        s = SUBTITLE_STYLES[style_name]
        w = int(os.environ.get("VIDEO_WIDTH", "1080"))
        h = int(os.environ.get("VIDEO_HEIGHT", "1920"))
        sec = s.get("SecondaryColour", "&H00FFFFFF")
        return (
            f"[Script Info]\n"
            f"ScriptType: v4.00+\n"
            f"PlayResX: {w}\n"
            f"PlayResY: {h}\n"
            f"WrapStyle: 0\n"
            f"\n"
            f"[V4+ Styles]\n"
            f"Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
            f"BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
            f"BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            f"Style: Default,{s['Fontname']},{s['Fontsize']},{s['PrimaryColour']},{sec},"
            f"{s['OutlineColour']},{s['BackColour']},{s['Bold']},0,0,0,100,100,0,0,"
            f"{s['BorderStyle']},{s['Outline']},{s['Shadow']},{s['Alignment']},10,10,{s['MarginV']},1\n"
            f"\n"
        )

    def _seconds_to_ass_time(self, seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = seconds % 60
        return f"{h}:{m:02d}:{s:05.2f}"
