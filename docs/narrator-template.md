# Narrator Component — Design Template

## Usage Pattern

Every lesson page uses `NarratorSlide` for voice-narrated text sections.

### Required Props
```tsx
<NarratorSlide
  text="Turkish narration text here"
  audioSrc="/lessons/unitX-dersY/narration-stepN.mp3"
  timingSrc="/lessons/unitX-dersY/narration-stepN.json"
  autoPlay={true}
/>
```

### Asset Generation

1. **Write narration text** — warm, fun, Damla speaking directly to a 10-year-old
2. **Generate audio + timestamps** via ElevenLabs with-timestamps API:
   - Voice: **Ayça** — `eUUtjbi66JcWz3T4Gvvo`
   - Model: `eleven_multilingual_v2`
   - Settings: `stability: 0.6, similarity_boost: 0.8, style: 0.3`
   - Endpoint: `POST /v1/text-to-speech/{voice_id}/with-timestamps`
3. **Save to** `public/lessons/unitX-dersY/`:
   - `narration-stepN.mp3` — audio file
   - `narration-stepN.json` — word timing array `[{word, start, end}, ...]`

### Python Script for Generating Assets
```python
import httpx, json, os, base64

API_KEY = os.environ.get("ELEVENLABS_API_KEY")
VOICE_ID = "eUUtjbi66JcWz3T4Gvvo"

def generate_narration(text, output_dir, step_name):
    mp3_path = os.path.join(output_dir, f"narration-{step_name}.mp3")
    json_path = os.path.join(output_dir, f"narration-{step_name}.json")

    resp = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/with-timestamps",
        headers={"xi-api-key": API_KEY, "Content-Type": "application/json"},
        json={
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.6, "similarity_boost": 0.8, "style": 0.3}
        },
        timeout=60
    )
    resp.raise_for_status()
    data = resp.json()

    # Save audio
    with open(mp3_path, "wb") as f:
        f.write(base64.b64decode(data["audio_base64"]))

    # Convert character timestamps to word timestamps
    align = data["alignment"]
    chars = align["characters"]
    starts = align["character_start_times_seconds"]
    ends = align["character_end_times_seconds"]

    words = text.split()
    word_timings = []
    char_idx = 0
    for word in words:
        while char_idx < len(chars) and chars[char_idx] in (' ', '\n', '\t'):
            char_idx += 1
        if char_idx >= len(chars):
            break
        word_start = starts[char_idx]
        end_idx = min(char_idx + len(word) - 1, len(chars) - 1)
        word_end = ends[end_idx]
        word_timings.append({"word": word, "start": round(word_start, 3), "end": round(word_end, 3)})
        char_idx += len(word)

    with open(json_path, "w") as f:
        json.dump(word_timings, f, ensure_ascii=False)
```

## Visual Design Rules

### Text Behavior
- **On page load**: Words are completely invisible (`opacity: 0`, `color: transparent`, `blur(8px)`)
- **Autoplay blocked**: Words stay invisible — NO fallback reveal. User must click play.
- **During playback**: Words materialize one by one synced to audio timestamps
- **Active word**: Teal color (`#2dd4a8`) + glow (`text-shadow`), NO font-weight change (causes layout shift)
- **Spoken words**: Settle at 0.75 opacity, `#c8c8d4` color
- **Transition duration**: Variable per word via `--wd` CSS var, derived from word's spoken duration (clamped 120-350ms)

### Layout
- **2/3 + 1/3 grid**: Text on left (2 columns), oscilloscope on right (1 column)
- **Play button**: Centered under text area
- **Mobile**: Stacks vertically

### Oscilloscope Visualizer
- Round circle container, transparent background, subtle border
- Teal waveform line (`#2dd4a8`) + glow layer
- Uses Web Audio API `AnalyserNode` connected to audio element
- Idle state: subtle breathing sine wave
- Active: real waveform from audio
- Canvas clipped to circle with padding (35%)
- Audio element needs `crossOrigin="anonymous"` for Web Audio API

### CSS Classes (in globals.css)
```
.narrator-card       — outer container
.narrator-layout     — 2fr 1fr grid
.narrator-text-col   — left column
.narrator-viz-col    — right column
.narrator-text       — word container (flex wrap)
.narrator-word       — individual word (hidden by default)
.narrator-word.spoken — word that has been said
.narrator-word.active — currently spoken word
.narrator-controls   — play button container
.narrator-play-btn   — circular play/pause button
.visualizer-container — round oscilloscope frame
.visualizer-canvas   — canvas element
```

### Performance Rules (from research)
- **Direct DOM manipulation** for word sync — never put `currentTime` in React state
- Use `requestAnimationFrame` loop, not `timeupdate` event
- Set `--wd` CSS variable per word via `el.style.setProperty()`
- Toggle `.active` / `.spoken` via `el.classList` — bypass React render cycle
- Clamp transition duration: `Math.max(120, Math.min(350, wordDurationMs))`

### Writing Style for Narrations
- Warm, conversational, like Damla talking to a friend
- Use "sen" (informal you), not "siz"
- Rhetorical questions: "Ne olur dersin?"
- Daily life metaphors: kitchen, school, friends, games
- Start with energy: "Merhabaa!", "Şimdi birlikte..."
- End with encouragement: "Tebrikler!", "Harikasın!"
- NEVER use "AI" — always "yapay zeka"
- Keep sentences short — 10-year-old reading level
