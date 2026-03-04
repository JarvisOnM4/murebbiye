# Mürebbiye — AI Curriculum Gap Analysis

**Date**: 2026-03-03
**Purpose**: Cross-validate Nate B Jones's vision for teaching kids AI against mürebbiye's current state, Turkish MEB curriculum, and educational best practices.
**Target**: 10-year-old Turkish children (4. sınıf ilkokul) — MVP audience.

---

## 1. THE VISION (Nate B Jones Summary)

### Source Material
- **Substack**: "My Kids Do Long Division by Hand. I Also Teach Them to Vibe Code." (2026-02-28, paywalled)
- **YouTube**: "How I'd Teach a 10 Year Old to Build Agentic Workflows (Claude Code)"
- **Substack**: "The Claude Code Complete Guide: Learn Vibe-Coding & Agentic AI"

### Core Philosophy
Jones's thesis: **Long division AND vibe coding are not contradictory — they're the only positions that make sense together.**

Key principles extracted from available content:
1. **Foundational skills matter** — Kids must learn to think before they learn to delegate to AI
2. **Cognitive offloading risk** — Without fundamentals, AI becomes a crutch, not a tool
3. **Seven principles** — Scalable framework for teaching AI at any age (5-15)
4. **Calculator parallel** — Just as calculators didn't replace math understanding, AI shouldn't replace thinking
5. **Vibe coding as literacy** — Treating AI prompting as a language skill, not a technical skill
6. **Claude Code as general-purpose agent** — Not a coding tool, but "a general purpose agent that happens to live in your terminal"
7. **Strategic abstraction** — Users should focus on intent and strategy, not implementation details

### What a 10-Year-Old Builds (from video evidence):
- Agents using Claude Code + WAT framework
- CLAUDE.md files as "agent job descriptions"
- Practical projects via vibe coding (no traditional programming required)
- Understanding of autonomy modes (plan, ask, autonomous)

---

## 2. WHAT A TURKISH 10-YEAR-OLD KNOWS TODAY

### MEB Curriculum Baseline (4. Sınıf / Grade 4)

**Mathematics** (71 kazanım, 180 ders saati):
- Numbers up to 6 digits (reading, writing, place value)
- Four operations with natural numbers (including long division)
- Fractions: simple, compound, mixed; addition/subtraction of like denominators
- Geometry: triangles, squares, rectangles; perimeter and area
- Measurement: time, length, weight, liquid
- Data: collection and basic interpretation

**Turkish Language** (Türkçe):
- Reading speed: 90-120 words/minute with comprehension
- Can write structured paragraphs
- Vocabulary sufficient for grade-level texts
- Can summarize and retell stories

**Hayat Bilgisi** (Life Studies, grades 1-3) / **Sosyal Bilgiler** (Social Studies, grade 4):
- 6 units, 45 outcomes, 108 lesson hours
- Critical thinking via "Neden?" questioning
- Map reading and spatial awareness
- Basic economics (needs, production-consumption)

**Science** (Fen Bilimleri, starts grade 3):
- 13 science process skills in TYMM model
- Scientific observation, classification, prediction
- Hypothesis formation, experimentation
- Inductive and deductive reasoning

**Information Technology** (Bilişim Teknolojileri):
- MEB curriculum exists for grades 1-4 (since 2018)
- In practice: varies wildly between schools (mandatory in some, elective in others)
- Topics: basic computer use, digital citizenship, intro to block-based coding
- **No AI content at all in grades 1-4**
- AI content starts in grade 5 (BTY.5.5.1: classify AI applications, BTY.5.5.2: AI ethics/security)
- New TYMM curriculum (2025-2026): adds AI literacy, cybersecurity, digital product design for grades 5-6

### Key Capabilities at Age 10
| Capability | Level | Implication for AI Education |
|---|---|---|
| Reading comprehension | Strong (90-120 wpm) | Can read AI prompts/responses in Turkish |
| Writing | Structured paragraphs | Can write prompts and instructions |
| Math reasoning | 4 operations, fractions, patterns | Can understand data concepts, basic algorithms |
| Scientific method | Observation → hypothesis → experiment | Maps directly to ML train → test → evaluate cycle |
| Computer use | Basic to moderate (school-dependent) | Some may need digital literacy bootstrapping |
| Coding experience | None to minimal | Most have zero exposure to block coding |
| AI knowledge | None | Complete blank slate |
| Critical thinking | Emerging | Foundation exists, needs scaffolding |

### Critical Gap: The Digital Divide
- **Private schools**: Often have robotics clubs, Scratch classes, tablets
- **Public schools**: May have no computer lab, no IT teacher, no device access
- Mürebbiye MUST work for both — this means unplugged activities are essential

---

## 3. EDUCATIONAL BEST PRACTICES (Research Summary)

### Developmental Psychology
- Age 10 = **Concrete Operational Stage** (Piaget) — can handle logical reasoning with concrete anchors
- **Zone of Proximal Development** (Vygotsky) — scaffolded AI tutor can serve as "more knowledgeable other"
- **Constructionism** (Papert) — children learn best by MAKING things, not hearing lectures

### AI4K12 Framework (Five Big Ideas)
1. **Perception** — Computers sense the world
2. **Representation & Reasoning** — Agents use models to think
3. **Learning** — Computers learn from data
4. **Natural Interaction** — AI communicates with humans
5. **Societal Impact** — AI has positive and negative effects

### Proven Programs
| Program | Ages | Approach | Turkish Available? |
|---|---|---|---|
| Code.org CS Fundamentals | K-5 | Spiral, online+unplugged | Yes (code.org/tr) |
| Scratch / ScratchJr | 5-8 / 8+ | Block-based programming | Yes (Turkish UI) |
| Machine Learning for Kids | 8+ | ML blocks in Scratch | No Turkish version |
| Google Teachable Machine | 6+ | Train ML models visually | No Turkish guide |
| MIT PopBots | 4-6 | Robot interaction | No Turkish version |
| AI4K12 Curriculum | K-12 | Standards framework | No Turkish version |

### Pedagogy Mix (Research-Backed)
- 10% Unplugged warm-up (physical, pattern games)
- 15% Story/narrative framing
- 40% Hands-on making (constructionist core)
- 20% Pair/group collaboration
- 15% Reflection and ethics

---

## 4. MÜREBBIYE CURRENT STATE

### What Exists (Production-Ready MVP)
| Component | Status | Details |
|---|---|---|
| Next.js 15 App | Built, tested | Admin + Student interfaces |
| PostgreSQL + Prisma | Schema ready | 14 models, 10 enums |
| Auth (NextAuth v5) | Working | Admin/Student roles |
| Curriculum Upload | Working | PDF/Markdown parser + chunker |
| Lesson Generation | Working | LLM-generated 35-min lessons (Explain → Practice → Independent → Assessment) |
| Student Assistant | Working | Scope-guarded Q&A within lesson context |
| Media Agent | Working | AI-generated diagrams, flowcharts, illustrations |
| Budget Tracking | Working | Per-lesson and monthly caps |
| Parent Reports | Working | Email summaries with metrics |
| AWS CDK Infra | Defined | RDS + S3 + IAM (not yet deployed) |
| CI/CD | Working | 88 tests passing |
| Turkish Localization | Partial | Templates + UI in Turkish, i18n infrastructure present |

### What's Missing (Deployment Blockers)
1. No AWS resources deployed (RDS, S3, IAM)
2. No domain (murebbiye.org not purchased)
3. No SMTP configured
4. Bedrock model access not requested
5. No real curriculum content uploaded

### What's Missing (For AI Education Mission)
1. **No AI-specific curriculum content** — system can deliver lessons but has no AI teaching material
2. **No interactive coding environment** — Scratch/block-coding integration absent
3. **No Teachable Machine integration** — can't do hands-on ML training
4. **No unplugged activity guides** — no offline/physical activities
5. **No teacher portal** — only Admin + Student roles, no multi-classroom support
6. **No gamification** — no badges, progression, rewards
7. **No parent onboarding** — parents need to understand WHY AI education matters
8. **No assessment rubrics** — lesson assessment is basic Q&A, not competency-based
9. **No collaborative features** — no pair work, group activities
10. **Only LLM track exists** — lesson generation is generic; no AI-concept-specific pedagogy

---

## 5. GAP ANALYSIS MATRIX

| Need | Jones Vision | MEB Coverage | Mürebbiye Has | GAP |
|---|---|---|---|---|
| Foundational thinking skills | Core principle — keep basics | Strong (math, science, Turkish) | Lesson generation engine | LOW — leverage school foundation |
| AI as literacy, not tech skill | "Vibe coding as language" | Starting grade 5 (2025-2026) | No AI curriculum content | HIGH — need full AI curriculum in Turkish |
| Hands-on making | Build agents, projects | Minimal (varies by school) | Media agent (passive consumption) | HIGH — need interactive making tools |
| Prompt engineering | CLAUDE.md, WAT framework | Not in curriculum | Student assistant (consumption only) | HIGH — need prompting exercises |
| Ethics and critical thinking | Cognitive offloading awareness | BTY.5.5.2 (grade 5 ethics) | None | HIGH — need ethics module |
| Progressive complexity | 7 principles (5-15 age range) | Spiral curriculum concept | Two tracks (English, AI_Module) | MEDIUM — need granular progression |
| Teacher enablement | (not directly addressed) | TYMM training programs | No teacher portal | HIGH — need teacher training |
| Parent engagement | Kitchen table learning | Parent meetings, reports | Parent email reports | MEDIUM — need parent portal/guide |
| Offline/unplugged activities | (not directly addressed) | CS Unplugged compatible | None | HIGH — critical for equity |
| Cultural context | US-centric | Turkish-centric | Turkish locale, but no content | HIGH — need Turkish-context AI examples |
| Assessment | (not directly addressed) | Competency-based (TYMM) | Basic Q&A assessment | MEDIUM — need portfolio assessment |
| Gamification | (not directly addressed) | Not in formal curriculum | None | MEDIUM — important for engagement |

### Priority Gaps (Must-Have for MVP)
1. **AI curriculum content in Turkish** — the entire educational payload
2. **Interactive exercises** — prompting playground, Teachable Machine integration
3. **Unplugged activity guides** — for schools without devices
4. **Teacher onboarding** — teachers are the bottleneck
5. **Cultural localization** — Turkish examples, Turkish context, Turkish values

### Secondary Gaps (Phase 2+)
6. Gamification (badges, progression)
7. Parent portal with AI literacy guide
8. Collaborative learning features
9. Portfolio-based assessment
10. Block-coding environment integration

---

## 6. STRATEGIC POSITIONING

### Mürebbiye's Unique Value Proposition
Turkey has **no comprehensive, Turkish-language AI curriculum for ages 4-10**. Existing options:
- BTK Akademi: targets older children, limited scope
- Kodwise: online coding classes, not AI-focused curriculum
- NextGen Lab: kindergarten AI (ages 4-6 only)
- Code.org Turkish: CS fundamentals, no AI content
- MEB TYMM: AI starts at grade 5, only 8 lesson hours, identification-level only

Mürebbiye can be **the first free, open, Turkish-language AI education platform for primary school children**, aligned with MEB's TYMM and designed by pedagogical principles.

### Alignment with MEB 2025-2029 AI Policy
MEB's AI in Education Policy Document identifies:
- Need for AI curricula adapted to Turkish context
- Teacher training as priority
- EBA/OBA as distribution channels
- Ethics committee oversight

Mürebbiye can complement MEB's top-down approach with a bottom-up, community-driven, open-source curriculum.
