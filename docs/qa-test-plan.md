# QA Test Plan — Mürebbiye Lesson & Exercise

## Lesson Flow (unit4-ders1)

### Step 1: Giriş (Narrator)
- [ ] Page loads with NO visible text (words hidden until voice plays)
- [ ] Play button visible and centered
- [ ] Clicking play: Ayça voice plays, words appear in sync
- [ ] Oscilloscope animates with voice audio
- [ ] Pause/replay works
- [ ] "Anahtar Kavram" card styled correctly (teal border, uppercase label)
- [ ] Next button works

### Step 2: Video + Takeaway
- [ ] Narrator plays with Ayça voice
- [ ] Video loads and plays
- [ ] "Ne öğrendik?" card matches Step 1 style
- [ ] ✓ and ✗ marks visible with correct colors (teal/red)
- [ ] Navigation works (back/next)

### Step 3: Exercise (Embedded)
- [ ] Exercise loads inline (no redirect, no iframe error)
- [ ] Two-column layout: chat LEFT, images RIGHT
- [ ] Target image visible and NOT cropped (object-fit: contain)
- [ ] Canvas area visible below target image
- [ ] Chat welcome message appears
- [ ] Textarea is focused and ready for input

#### Chat Interaction Tests
- [ ] Type "mavi araba" → car + blue overlay layers appear
- [ ] Type "çocuk" → boy layer appears
- [ ] Type "köpek" → dog layer appears
- [ ] Type gibberish "asdfgh" → gentle redirect, NO layers change
- [ ] Type offensive content → neutral redirect, NO layers change
- [ ] Type unrelated question "hava nasıl?" → redirect to exercise
- [ ] Type single char "a" → ask for more detail
- [ ] After send, textarea refocuses automatically
- [ ] Messages scroll as they grow
- [ ] "Düşünüyor..." appears while waiting, then replaced by response
- [ ] Response arrives within 30 seconds (not hanging forever)

#### Completion Flow
- [ ] When all elements described → all layers visible (complete picture)
- [ ] Chat shows congratulation message from agent
- [ ] User can see the completed picture for at least 3-4 seconds
- [ ] THEN completion modal appears with confetti
- [ ] Modal shows attempt count and hints used
- [ ] "Derse Dön" button goes back to lesson page (not main chat)

### Step 4: Video 2 + Takeaway
- [ ] Same checks as Step 2

### Step 5: Summary
- [ ] Summary cards render with icons
- [ ] "Dersi Bitir" button works
- [ ] Returns to student dashboard

## Cross-cutting
- [ ] No horizontal scrollbar on any step
- [ ] Dark theme consistent throughout
- [ ] Mobile layout stacks correctly (test at 375px width)
- [ ] No console errors in browser DevTools
- [ ] All audio files load (no 404s for narration MP3s)
- [ ] All exercise images load (no 404s for PNGs)

## Performance
- [ ] Page loads in under 3 seconds
- [ ] Narrator audio starts within 1 second of play
- [ ] Exercise chat response under 30 seconds
- [ ] No layout shift during any transition
