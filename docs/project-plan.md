# Mürebbiye — Project Plan

**Date**: 2026-03-03
**Author**: Project Team
**Mission**: Prepare Turkish children for an AI future — free, open, in Turkish.
**MVP Audience**: 10-year-old children (4. sınıf ilkokul)
**Prerequisite**: [AI Curriculum Gap Analysis](ai-curriculum-gap-analysis.md)

---

## 1. MISSION STATEMENT

Mürebbiye will be **the first free, open-source, Turkish-language AI education platform for primary school children**. It bridges the gap between MEB's TYMM curriculum (which starts AI at grade 5) and the reality that children are already interacting with AI daily.

The name mürebbiye (مربیه — governess, tutor) reflects the philosophy: not a replacement for school, but a wise companion that walks alongside the child. Like Jones's thesis — long division AND vibe coding — mürebbiye teaches children to think WITH AI, not defer TO it.

**For**: Türk Gençliği — the next generation.
**Cost to families**: Zero. Always.

---

## 2. DESIGN PRINCIPLES

1. **Temel önce** (Foundations first) — AI literacy builds on existing MEB foundations (math reasoning, scientific method, Turkish comprehension). Never skip fundamentals.
2. **Yaparak öğren** (Learn by making) — Papert's constructionism in Turkish. Children build, not consume.
3. **Her çocuk için** (For every child) — Works without devices (unplugged), without fast internet (offline-first), without private school resources.
4. **Kültürel bağlam** (Cultural context) — Examples from Turkish daily life, not translated American content. Nasreddin Hoca, not fairy tales. Turkish agriculture, not Silicon Valley.
5. **Aile ile birlikte** (Together with family) — Parents understand why, teachers know how, children experience what.
6. **Eleştirel düşünce** (Critical thinking) — Jones's cognitive offloading warning, localized. "AI bir araç, düşünmenin yerini almaz." (AI is a tool, it doesn't replace thinking.)

---

## 3. CURRICULUM ARCHITECTURE

### Framework: AI4K12 Five Big Ideas × Turkish Context

The curriculum maps AI4K12's five big ideas onto concrete, culturally relevant units for 10-year-olds.

| # | AI4K12 Big Idea | Turkish Unit Name | Turkish Context |
|---|---|---|---|
| 1 | Perception | **Bilgisayar Dünyayı Nasıl Görür?** (How does a computer see the world?) | Phone camera recognizing faces in family photos, voice assistants understanding Turkish, Shazam identifying Turkish songs |
| 2 | Representation & Reasoning | **Yapay Zeka Nasıl Düşünür?** (How does AI think?) | GPS navigation in Istanbul traffic, chess AI (Turkey has strong chess tradition), recommendation algorithms on YouTube |
| 3 | Learning | **Bilgisayar Nasıl Öğrenir?** (How does a computer learn?) | Training a model to recognize Turkish handwriting, sorting photos of Turkish food, predicting weather in Ankara |
| 4 | Natural Interaction | **AI ile Konuşmak** (Talking with AI) | Prompt engineering in Turkish, chatbot conversations, voice commands to Siri/Google in Turkish |
| 5 | Societal Impact | **AI ve Biz** (AI and Us) | Deepfakes in Turkish media, AI in Turkish healthcare, farming automation in Anatolia, ethical dilemmas |

### Unit Structure (Per Big Idea)

Each unit = 6 lessons × 35 minutes = 210 minutes (3.5 hours)
Total curriculum = 5 units × 6 lessons = 30 lessons = ~17.5 hours

**Lesson Flow** (aligns with existing mürebbiye engine):

| Phase | Minutes | Activity Type | Description |
|---|---|---|---|
| Isınma (Warm-up) | 5 | Unplugged | Physical game, puzzle, or pattern activity |
| Hikaye (Story) | 5 | Narrative | Animated scenario or comic strip in Turkish |
| Açıklama (Explain) | 7 | Guided instruction | Core concept with Turkish examples |
| Uygulama (Practice) | 10 | Interactive exercise | Hands-on: prompting playground, Teachable Machine, or guided activity |
| Bağımsız (Independent) | 5 | Self-directed | Student applies concept independently |
| Düşünme (Reflection) | 3 | Ethics/discussion | "Bu doğru mu?" (Is this right?) critical thinking prompt |

### Unplugged Activity Library

Every lesson has an unplugged alternative for schools without devices:

| AI Concept | Unplugged Activity | Materials |
|---|---|---|
| Classification (ML) | Sort cards by hidden rule, others guess the rule | Index cards, markers |
| Training data | "Teach a friend" game — give examples until they learn the pattern | Paper, pencil |
| Neural networks | Human relay game — pass messages through a network of students | None (bodies) |
| Bias in data | Biased survey game — ask leading questions, see skewed results | Survey forms |
| Prompt engineering | "Robot Oyunu" — one student is the robot, follows exact instructions | None |
| Image recognition | "What am I?" — describe objects with limited vocabulary | Blindfold, objects |
| Decision trees | 20 Questions with structured yes/no tree on whiteboard | Whiteboard |
| Recommendation systems | "Arkadaşına Kitap Öner" — recommend books based on friend's preferences | Book list |
| Natural language | Telephone game with Turkish sentences, show information loss | None |
| Ethical dilemmas | Trolley problem variants with AI context, classroom debate | Scenario cards |

---

## 4. PHASED IMPLEMENTATION

### Phase 0: Deploy Foundation (Infrastructure)
**Goal**: Get the existing mürebbiye platform live.

| Task | Details | Depends On |
|---|---|---|
| Deploy AWS CDK stack | RDS + S3 + IAM via `infra/` | AWS account |
| Purchase domain | murebbiye.org or murebbiye.com.tr | Budget decision |
| Configure SMTP | SES or alternative for parent emails | AWS setup |
| Request Bedrock model access | Claude 3.5 Haiku in us-east-1 | IAM user |
| Configure Vercel deployment | Connect repo, set env vars | Domain |
| Seed admin user | Via `npm run db:seed` | RDS deployed |
| Smoke test all existing features | Curriculum upload, lesson gen, assistant, media agent | All above |

**Exit criteria**: Admin can upload a document, generate a lesson, student can take it, parent gets email report.

---

### Phase 1: AI Curriculum Content (The Payload)
**Goal**: Create the 30-lesson Turkish AI curriculum.

| Task | Details | Output |
|---|---|---|
| Write Unit 1: Perception (6 lessons) | Full lesson content in Turkish: warm-up, story, explanation, practice, reflection | 6 lesson markdown files |
| Write Unit 2: Representation (6 lessons) | Same structure, chess/GPS/recommendation contexts | 6 lesson files |
| Write Unit 3: Learning (6 lessons) | Same structure, handwriting/food/weather contexts | 6 lesson files |
| Write Unit 4: Natural Interaction (6 lessons) | Same structure, prompting/chatbot/voice contexts | 6 lesson files |
| Write Unit 5: Societal Impact (6 lessons) | Same structure, deepfake/health/farming contexts | 6 lesson files |
| Write unplugged activity guide | Teacher-facing guide for all 30 lessons, printable | PDF/Markdown |
| Create media assets | Diagrams, flowcharts, illustrations for each lesson via Media Agent | Generated assets |
| Upload all content | Ingest via curriculum upload API | DB populated |
| Review cycle | Native Turkish speaker review for language quality | Revised content |

**Content creation approach**: Use mürebbiye's own LLM lesson generation engine to draft initial content, then human-review and culturally contextualize. The engine already supports the Explain → Practice → Independent → Assessment flow.

**Exit criteria**: All 30 lessons loadable and deliverable through the existing platform.

---

### Phase 2: Interactive Exercises (Making, Not Consuming)
**Goal**: Transform mürebbiye from content delivery to hands-on learning.

| Task | Details | Technical Change |
|---|---|---|
| **Prompting Playground** | Students write Turkish prompts, see AI responses, iterate | New component: `PromptPlayground` in student UI. Uses existing `callLlm()` with budget guard. Scope-limited to lesson context. |
| **Teachable Machine embed** | Embed Google Teachable Machine for image/sound ML training | iframe integration in lesson pages. No backend change. Turkish instruction overlay. |
| **"Robot Oyunu" simulator** | Digital version of the instruction-following game | New component: `RobotGame` — grid-based, block-instruction input, visual feedback. Pure frontend. |
| **Quiz improvements** | Move from free-text Q&A to multiple-choice + drag-drop + matching | Extend `LessonInteraction` model with `questionType` enum. New frontend components. |
| **Progress tracking** | Per-unit completion, per-lesson scores, streak counter | New Prisma model: `StudentProgress` (studentId, unitId, lessonId, score, completedAt). API routes. |

**Technical scope**: 2 new Prisma models, 3-4 new React components, 2-3 new API routes. No new infrastructure.

**Exit criteria**: Student can interact with prompting playground, train a Teachable Machine model, complete interactive quizzes with varied question types.

---

### Phase 3: Teacher & Parent Experience
**Goal**: Enable teachers and parents to guide the learning journey.

| Task | Details | Technical Change |
|---|---|---|
| **Teacher role** | New `TEACHER` role in NextAuth. Can create classrooms, assign lessons, view class progress. | New enum value, new Prisma models: `Classroom`, `ClassroomStudent`. Teacher dashboard pages. |
| **Teacher onboarding guide** | Step-by-step guide for teachers with no AI background | Static content in Turkish, accessible from teacher dashboard |
| **Classroom view** | Teacher sees all students' progress, scores, time spent | New API routes for aggregated metrics per classroom |
| **Parent portal** | Parents log in, see child's progress, read AI literacy guide | New parent-facing pages. Leverage existing `parentEmail` on User model. |
| **Parent AI literacy guide** | "Yapay Zeka Nedir ve Çocuğunuz Neden Öğrenmeli?" | Static content, linked from parent portal and email reports |
| **Assignment system** | Teachers can assign specific lessons or units to students | New Prisma model: `Assignment` (teacherId, studentId, lessonIds, dueDate) |

**Exit criteria**: A teacher can create a classroom, add students, assign Unit 1, monitor completion, and parents can see their child's progress.

---

### Phase 4: Gamification & Engagement
**Goal**: Make learning sticky and fun.

| Task | Details | Technical Change |
|---|---|---|
| **Badge system** | Earn badges for: completing units, streaks, high scores, helping others | New models: `Badge`, `StudentBadge`. Badge gallery in student UI. |
| **XP and levels** | Experience points per activity, level progression | `xp` column on `User` or `StudentProgress`. Level thresholds. |
| **Leaderboard** | Classroom-level leaderboard (opt-in, teacher-controlled) | API route for classroom rankings. Privacy toggle. |
| **Achievements** | Special achievements: "First prompt!", "Trained a model!", "Asked a great question!" | Event-driven badge triggers in lesson completion flow |
| **Certificate** | Printable completion certificate per unit | PDF generation with student name, unit, date. Turkish template. |

**Exit criteria**: Student earns badges, sees XP progression, can print certificate after completing a unit.

---

### Phase 5: Advanced Features (Post-MVP)
**Goal**: Scale and deepen the platform.

| Task | Priority |
|---|---|
| **Block coding integration** (Scratch-like environment for AI concepts) | High |
| **Portfolio assessment** (student project gallery, rubric-based evaluation) | High |
| **Collaborative features** (pair coding, group projects, peer review) | Medium |
| **Offline/PWA mode** (service worker, lesson caching for low-connectivity areas) | Medium |
| **Additional age groups** (adapt curriculum for ages 6-8 and 12-14) | Medium |
| **MEB alignment report** (formal mapping to TYMM outcomes for school adoption) | High |
| **EBA/OBA integration** (publish content through MEB's distribution channels) | High |
| **Open content API** (allow other Turkish education platforms to use the curriculum) | Low |
| **Community contributions** (teachers submit unplugged activities, translated content) | Low |

---

## 5. TECHNICAL ARCHITECTURE CHANGES

### What Stays the Same
The existing mürebbiye architecture is solid and well-suited for Phase 0-1:

- **Next.js 15 App Router** — no change
- **Prisma + PostgreSQL** — no change, just add models
- **LLM via Zeus Gateway** — no change (curriculum generation + student assistant)
- **Media Agent** — no change (generates lesson visuals)
- **Budget tracking** — no change (guards LLM spend)
- **Auth (NextAuth v5)** — extend with TEACHER role, no replace
- **S3 storage** — no change
- **CI/CD** — no change

### What Changes

| Phase | Schema Changes | New Components | New API Routes |
|---|---|---|---|
| 0 | None | None | None |
| 1 | None (content uploaded via existing flow) | None | None |
| 2 | `StudentProgress`, extend `LessonInteraction` | `PromptPlayground`, `RobotGame`, quiz components | `/api/student/progress`, `/api/student/playground` |
| 3 | `Classroom`, `ClassroomStudent`, `Assignment`, extend `UserRole` | Teacher dashboard, parent portal | `/api/teacher/*`, `/api/parent/*` |
| 4 | `Badge`, `StudentBadge`, `xp` fields | Badge gallery, leaderboard, certificate | `/api/student/badges`, `/api/teacher/leaderboard` |

### Data Model Additions (Phase 2-4)

```prisma
// Phase 2
model StudentProgress {
  id          String   @id @default(cuid())
  studentId   String
  unitNumber  Int
  lessonNumber Int
  score       Decimal  @db.Decimal(5, 4)
  completedAt DateTime
  student     User     @relation(fields: [studentId], references: [id])

  @@unique([studentId, unitNumber, lessonNumber])
  @@index([studentId])
}

// Phase 3
model Classroom {
  id        String   @id @default(cuid())
  teacherId String
  name      String
  code      String   @unique  // join code for students
  teacher   User     @relation("TeacherClassrooms", fields: [teacherId], references: [id])
  students  ClassroomStudent[]
  createdAt DateTime @default(now())
}

model ClassroomStudent {
  id          String   @id @default(cuid())
  classroomId String
  studentId   String
  joinedAt    DateTime @default(now())
  classroom   Classroom @relation(fields: [classroomId], references: [id])
  student     User      @relation(fields: [studentId], references: [id])

  @@unique([classroomId, studentId])
}

model Assignment {
  id          String   @id @default(cuid())
  classroomId String
  unitNumber  Int
  lessonNumber Int?    // null = entire unit
  dueDate     DateTime?
  createdAt   DateTime @default(now())
}

// Phase 4
model Badge {
  id          String   @id @default(cuid())
  key         String   @unique   // e.g. "first_prompt", "unit_1_complete"
  titleTr     String
  titleEn     String
  descTr      String
  descEn      String
  iconUrl     String?
}

model StudentBadge {
  id        String   @id @default(cuid())
  studentId String
  badgeId   String
  earnedAt  DateTime @default(now())
  student   User     @relation(fields: [studentId], references: [id])
  badge     Badge    @relation(fields: [badgeId], references: [id])

  @@unique([studentId, badgeId])
}
```

---

## 6. CONTENT CREATION STRATEGY

### Approach: LLM-Drafted, Human-Reviewed

1. **Draft**: Use mürebbiye's own lesson generation engine (callLlm) to produce initial Turkish content for each lesson. The system prompt specifies: target age 10, Turkish cultural context, AI4K12 alignment, constructionist pedagogy.

2. **Structure**: Each lesson file is a markdown document with sections matching the lesson flow (Isınma, Hikaye, Açıklama, Uygulama, Bağımsız, Düşünme). The existing curriculum parser handles markdown ingestion.

3. **Review**: Native Turkish speaker reviews for:
   - Language naturalness (not translation-ese)
   - Cultural appropriateness
   - Age-appropriate vocabulary
   - Factual accuracy of AI concepts
   - Alignment with MEB terminology

4. **Media**: Each lesson gets 2-3 media assets via the Media Agent (diagrams, flowcharts, illustrations). The two-stage pipeline (analyze → storyboard approval → generate) ensures quality.

5. **Unplugged companion**: Every lesson has a parallel unplugged activity. These are written separately as teacher-facing guides with materials lists, setup instructions, and facilitation notes.

### Content Priority Order
1. Unit 4: Natural Interaction (most immediately relevant — kids are already talking to AI)
2. Unit 1: Perception (most concrete — cameras, microphones, sensors)
3. Unit 3: Learning (most hands-on — Teachable Machine integration)
4. Unit 5: Societal Impact (most critical — ethics and critical thinking)
5. Unit 2: Representation & Reasoning (most abstract — save for last)

---

## 7. EQUITY STRATEGY

### The Digital Divide Problem
Turkey's education system has a stark divide: private schools with robotics labs vs. public schools with no computer lab. Mürebbiye must serve both.

### Three-Tier Access Model

| Tier | Device Access | Internet | Mürebbiye Experience |
|---|---|---|---|
| **Full Digital** | Personal device or school lab | Reliable | Full platform: prompting playground, Teachable Machine, media, progress tracking |
| **Shared Digital** | Shared classroom device or teacher's phone | Intermittent | Teacher-led demos, students observe and discuss, individual practice on rotation |
| **Unplugged Only** | None | None | Printed activity guides, physical games, classroom discussions. Teacher downloads & prints from platform. |

### Implementation
- All lesson content is downloadable as PDF (teacher prints for class)
- Unplugged activity guides are standalone documents (no platform dependency)
- Media assets are pre-rendered (no real-time LLM calls needed during lesson delivery)
- Student progress can be recorded on paper and entered by teacher later (batch mode)

---

## 8. SUCCESS METRICS

### Phase 0 (Deploy)
- Platform accessible at production URL
- Admin can complete full curriculum workflow
- Student can take a lesson end-to-end

### Phase 1 (Content)
- 30 lessons uploaded and deliverable
- 30 unplugged activity guides written
- Native speaker review completed (>90% approval rate)
- At least 3 pilot students complete Unit 1

### Phase 2 (Interactive)
- Prompting playground functional
- Teachable Machine integration working
- Student engagement time per lesson > 25 minutes (vs. current 15-20 for passive content)

### Phase 3 (Teachers & Parents)
- At least 1 teacher creates a classroom and assigns lessons
- At least 5 parents access the parent portal
- Teacher satisfaction survey > 4/5

### Phase 4 (Gamification)
- Badge earn rate > 80% for completed lessons
- Return rate (students who come back for next lesson) > 70%

---

## 9. RISK REGISTER

| Risk | Impact | Mitigation |
|---|---|---|
| **Content quality** — LLM-generated Turkish reads like a translation | High | Human review by native speaker, cultural contextualization pass |
| **Teacher adoption** — teachers don't understand AI themselves | High | Teacher onboarding guide, video walkthroughs, WhatsApp support group |
| **Infrastructure cost** — LLM calls for interactive features exceed budget | Medium | Budget mode system already exists. Cap prompting playground at 10 calls/lesson. Pre-generate content. |
| **MEB resistance** — platform seen as competing with official curriculum | Medium | Frame as complementary, align with TYMM outcomes, seek endorsement not competition |
| **Digital divide** — unplugged activities feel second-class | Medium | Design unplugged first, then add digital. Not the reverse. |
| **Scope creep** — trying to serve all ages before nailing age 10 | High | Strict MVP focus: 4. sınıf only until Phase 5 |
| **Sustainability** — no revenue model, depends on volunteer effort | Low (short-term) | Open source, community-driven. Costs are minimal (t4g.micro + S3 + LLM budget cap). |

---

## 10. IMMEDIATE NEXT STEPS

1. **Deploy Phase 0** — get the existing platform live (AWS CDK deploy, domain, SMTP)
2. **Write Unit 4 lesson 1** — "AI ile İlk Sohbet" (First Chat with AI) as proof of concept
3. **Create unplugged guide** for lesson 1 — "Robot Oyunu" (Robot Game)
4. **Upload and test** — verify the existing lesson engine delivers AI content well
5. **Find a Turkish reviewer** — native speaker to validate language and cultural fit
6. **Create teacher onboarding doc** — 2-page "Mürebbiye Nedir?" (What is Mürebbiye?) guide

---

## APPENDIX A: Alignment with MEB TYMM

| TYMM Outcome (Grade 5) | Mürebbiye Covers In | Phase |
|---|---|---|
| BTY.5.5.1: Classify AI applications | Unit 1 (Perception), Unit 2 (Reasoning) | 1 |
| BTY.5.5.2: AI ethics and security | Unit 5 (AI and Us) | 1 |
| BTY.5.6.1: Digital product design | Unit 4 (Natural Interaction — prompting) | 2 |
| BTY.5.2.1: Algorithmic thinking | Unit 2 (Representation & Reasoning) | 1 |
| BTY.5.3.1: Block-based coding | Phase 5 (Scratch integration) | 5 |

Mürebbiye gives 4th graders a **one-year head start** on grade 5 TYMM outcomes, in a deeper and more hands-on format than the 8 lesson hours MEB allocates.

## APPENDIX B: Jones's Seven Principles Mapping

| Jones Principle | Mürebbiye Implementation |
|---|---|
| Foundational skills matter | Design Principle #1: "Temel önce" — builds on MEB math/science/Turkish |
| Cognitive offloading risk | Unit 5 ethics module + reflection phase in every lesson |
| Scalable framework | 5-unit structure extensible to ages 6-8 and 12-14 in Phase 5 |
| Calculator parallel | Explained in parent guide and teacher onboarding |
| Vibe coding as literacy | Unit 4: prompting as a language skill, not a tech skill |
| AI as general-purpose agent | Prompting playground shows AI doing math, writing, analysis — not just code |
| Strategic abstraction | Progressive complexity: observe → interact → create → evaluate |
