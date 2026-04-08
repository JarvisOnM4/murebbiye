# Mürebbiye — Complete Product Requirements

## Product Vision
Free, open-source Turkish AI education platform for 10-year-old children (4. sınıf). Teaches AI literacy through interactive lessons, animated videos, and hands-on exercises.

## Curriculum Structure
- 5 units × 6 lessons = 30 lessons
- Each lesson = ~22 minutes
- Language: Turkish-first

### Units
1. **Yapay Zeka Nedir?** — What is AI?
2. **Yapay Zeka Nasıl Öğrenir?** — How does AI learn?
3. **Günlük Hayatta AI** — AI in daily life
4. **AI ile Üretmek** — Creating with AI (PRIORITY — Unit 4 first)
5. **AI ve Gelecek** — AI and the future

## Lesson Page Requirements

### Narrator System
- **Voice**: Ayça (ElevenLabs voice ID: eUUtjbi66JcWz3T4Gvvo, eleven_multilingual_v2)
- **Word sync**: Words appear in sync with audio using ElevenLabs word timestamps
- **Transition**: Variable duration per word (clamped 120-350ms), ease-out, no layout shift
- **On load**: Words completely invisible (opacity: 0, blur, transparent color)
- **Autoplay blocked**: Words stay hidden — user must click play
- **Active word**: Teal glow (text-shadow), no font-weight change
- **Spoken words**: 0.75 opacity settle
- **Oscilloscope**: Round circle, teal waveform synced to audio via Web Audio API AnalyserNode
- **Layout**: 2/3 text (left) + 1/3 oscilloscope (right)
- **Play button**: SVG icons (play/pause/replay), centered under text
- **Direct DOM manipulation** for word sync — no React re-renders during playback

### Video Clips
- Generated via FLUX Pro (keyframe) → Kling 2.0 I2V → ElevenLabs Ayça → ffmpeg
- Resolution: 854x480
- Per-scene voice sync
- Poster images for each clip

### Takeaway Cards ("Ne öğrendik?")
- Match key-concept card style (teal border, uppercase label)
- Good outcomes: teal bold + ✓
- Bad outcomes: red bold + ✗
- Compact — no excessive line wrapping

### Navigation
- Step indicator at top
- Back/Next buttons
- "Dersi Bitir" on last step → student dashboard

## Drawing Exercise Requirements

### Layout
- Two equal columns (CSS grid: 1fr 1fr)
- Left: Chat panel (full height, scrollable messages)
- Right: Target image (top) + Canvas (bottom)
- Responsive: stack at 640px
- No scrolling needed — fits in viewport

### Target Image
- Reference image the child needs to describe
- object-fit: contain (never cropped)
- Hint highlights overlay with tooltips

### Canvas
- Layered PNGs stacked by zIndex
- Layers fade in (0.5s transition) as child describes elements
- object-fit: contain for all layer images

### Chat Panel
- Welcome message on load
- Textarea with Enter to send (Shift+Enter for newline)
- Auto-refocus after send (requestAnimationFrame delay)
- "Düşünüyor..." indicator while LLM processes
- Min 3 chars, max 300 chars
- Hint button with remaining count

### LLM Agent (Drawing)
- Primary: OpenRouter (qwen3-235b via cloud)
- Fallback: Ollama qwen3:14b (local)
- response_format: { type: "json_object" } for OpenRouter
- JSON extraction: strip thinking text before parsing
- System prompt in Turkish, age-appropriate responses

### Detection System
- Each exercise element has detectionHints array (Turkish vocabulary)
- Vocabulary must cover every reasonable way a 10-year-old might describe the element
- Elements: car, car_type, car_color, boy, girl, dog, dog_ears (for mavi-cabrio)
- Dependencies: car_type depends on car, car_color depends on car, dog_ears depends on dog

### Redirect Rules (when input doesn't match)
- No-match: gentle redirect ("Resimde onu göremiyorum...")
- Gibberish: ask for more detail
- Off-topic: redirect to exercise
- Offensive: neutral redirect
- ALL elements stay "missing" — never reveal layers for unmatched input

### Completion Flow
1. All required elements described → all layers visible (complete picture)
2. Chat shows congratulation message from LLM agent
3. User sees completed picture for 4 seconds
4. THEN completion modal appears with confetti animation
5. Modal shows: attempt count, hints used
6. "Derse Dön" button → back to lesson page (not main chat)

## Technical Stack
- Next.js 15, React 19, Tailwind CSS, Prisma ORM
- PostgreSQL (Docker, port 5432)
- LLM: OpenRouter (cloud) with Ollama fallback (local)
- TTS: ElevenLabs (Ayça voice)
- Image gen: fal.ai FLUX Pro
- Video gen: fal.ai Kling 2.0 I2V
- Auth: NextAuth v5 beta + learner tokens

## Design System
- Dark theme throughout
- Primary accent: teal #2dd4a8
- Error/bad: red #f87171
- Text: #f0ede6 (primary), #c8c8d4 (secondary), #6b6b7b (muted)
- Background: dark gradients
- Rounded corners: 14px cards, 12px containers
- Consistent typography: Space Grotesk for display, system sans for body
- Every button has title= tooltip
- All animations: ease-out, variable duration where appropriate

## SDLC Pipeline
- See docs/sdlc-pipeline.md
- Orchestrator writes test plans
- QA Engineer executes them
- Inspector reviews code changes
- No shipping without QA sign-off

## Content Creation Pipeline
- See docs/narrator-template.md for voice generation
- See r2-assistant/scripts/ for video production
- See docs/qa-test-plan.md for testing checklist
