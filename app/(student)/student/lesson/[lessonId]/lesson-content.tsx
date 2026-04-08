"use client";

import { useEffect, useState } from "react";
import { NarratorSlide } from "./narrator-slide";
import { StepIndicator } from "./step-indicator";
import { DrawingExercise } from "../../exercise/[exerciseId]/drawing-exercise";

type Exercise = {
  id: string;
  slug: string;
  titleTr: string;
  descriptionTr: string;
  templateSpec: unknown;
} | null;

type ExerciseData = {
  id: string;
  slug: string;
  titleTr: string | null;
  titleEn: string | null;
  descriptionTr: string | null;
  targetImageKey: string | null;
  maxAttempts: number;
  elements: {
    id: string;
    labelTr: string;
    labelEn?: string | null;
    category: string;
    activatesLayers: string[];
    dependsOn?: string | null;
  }[];
  layers: {
    id: string;
    imageKey: string;
    zIndex: number;
    defaultVisible: boolean;
    mutuallyExclusive?: string[];
  }[];
};

type AttemptData = {
  attemptCount: number;
  hintsUsed: number;
  matchedElements: Record<string, string>;
  status: string;
};

type ExerciseAttempt = {
  exercise: ExerciseData;
  attemptId: string;
  attempt: AttemptData;
} | null;

type Props = {
  exercise: Exercise;
  exerciseAttempt?: ExerciseAttempt;
};

const STEPS = [
  { number: 1, title: "Giriş" },
  { number: 2, title: "İzle: Arkadaşına Resim Çizdir" },
  { number: 3, title: "Uygula: Resim Çizdir" },
  { number: 4, title: "İzle: Adım Adım Tarif" },
  { number: 5, title: "Özet" },
];

type KeyConceptProps = {
  term: string;
  definition: string;
};

function KeyConcept({ term, definition }: KeyConceptProps) {
  return (
    <div className="key-concept-card">
      <p className="key-concept-label">Anahtar Kavram</p>
      <p className="key-concept-term">{term}</p>
      <p className="key-concept-definition">{definition}</p>
    </div>
  );
}

export function LessonContent({ exercise, exerciseAttempt }: Props) {
  const [currentStep, setCurrentStep] = useState(1);

  // Cancel any ongoing speech when the step changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [currentStep]);

  const goNext = () => {
    if (currentStep < STEPS.length) setCurrentStep((s) => s + 1);
  };

  const goPrev = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const isFirst = currentStep === 1;
  const isLast = currentStep === STEPS.length;

  const currentTitle = STEPS.find((s) => s.number === currentStep)?.title ?? "";

  return (
    <div className="lesson-shell">
      {/* Header */}
      <div className="lesson-header">
        <a
          href="/student"
          className="lesson-back"
          title="Öğrenci panosuna dön"
        >
          &larr; Geri
        </a>
        <div>
          <p className="lesson-unit-label">Ünite 4 &middot; Ders 1</p>
          <h1 className="lesson-title">AI ile İlk Sohbet</h1>
          <p className="lesson-subtitle">
            Yapay zekaya nasıl doğru talimat verilir?
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator steps={STEPS} currentStep={currentStep} />

      {/* Step content */}
      <div className="step-content" key={currentStep}>
        <h2 className="step-title">{currentTitle}</h2>

        {/* Step 1: Giriş */}
        {currentStep === 1 && (
          <>
            <NarratorSlide
              text="Merhabaa! Ben Damla! Bugün seninle çok eğlenceli bir şey öğreneceğiz — yapay zeka ile nasıl konuşulur! Biliyorsun, yapay zeka dediğimiz şey aslında çok akıllı bir bilgisayar. Ama ona bir şey yaptırmak istediğinde, çok açık ve net konuşman gerekiyor. Buna 'prompt' diyoruz. Prompt, yapay zekaya verdiğin talimat demek. Tıpkı arkadaşından bir şey isterken olduğu gibi — ne kadar iyi anlatırsan, o kadar güzel sonuç alırsın!"
              audioSrc="/lessons/unit4-ders1/narration-step1.mp3"
              timingSrc="/lessons/unit4-ders1/narration-step1.json"
            />
            <KeyConcept
              term="Prompt"
              definition="Yapay zekaya verdiğiniz talimat"
            />
          </>
        )}

        {/* Step 2: Video Clip 1 */}
        {currentStep === 2 && (
          <>
            <NarratorSlide
              text="Şimdi birlikte çok komik bir şey izleyeceğiz! Bir arkadaşından gözlerini kapatıp resim çizmesini istedin diyelim. Ama ona sadece 'bir şey çiz' dedin. Ne olur dersin? Hadi izleyelim!"
              audioSrc="/lessons/unit4-ders1/narration-step2.mp3"
              timingSrc="/lessons/unit4-ders1/narration-step2.json"
            />
            <div className="lesson-video-container">
              <video
                controls
                preload="metadata"
                poster="/lessons/unit4-ders1/clip1-poster.jpg"
                className="lesson-video"
                title="Video: Arkadaşına Resim Çizdir"
              >
                <source src="/lessons/unit4-ders1/clip1.mp4" type="video/mp4" />
              </video>
            </div>
            <div className="lesson-video-takeaway">
              <strong>Ne öğrendik?</strong>
              <div className="takeaway-rows">
                <p><span className="takeaway-check">&#x2713;</span> <span className="takeaway-good glow">Net talimat</span> = <strong className="takeaway-good">güzel sonuç</strong></p>
                <p><span className="takeaway-cross">&#x2717;</span> <span className="takeaway-bad">Belirsiz talimat</span> = <strong className="takeaway-bad">karışık sonuç</strong></p>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Drawing Exercise */}
        {currentStep === 3 && (
          <>
            <NarratorSlide
              text="Sıra sende! Şimdi yapay zekaya bir resim çizdireceğiz. Ama dikkat — yapay zeka senin ne düşündüğünü bilemez! Her şeyi kelimelerle anlatman gerekiyor. Rengi, şekli, büyüklüğü, nerede olduğunu... Ne kadar detay verirsen, o kadar güzel bir resim çıkar. Hazır mısın?"
              audioSrc="/lessons/unit4-ders1/narration-step3.mp3"
              timingSrc="/lessons/unit4-ders1/narration-step3.json"
            />
            {exercise && exerciseAttempt ? (
              <div className="lesson-exercise-embed">
                <DrawingExercise
                  exerciseId={exercise.id}
                  attemptId={exerciseAttempt.attemptId}
                  exercise={exerciseAttempt.exercise}
                  attempt={exerciseAttempt.attempt}
                />
              </div>
            ) : (
              <div className="lesson-exercise-card lesson-exercise-coming">
                <div className="lesson-exercise-icon" aria-hidden="true">
                  🔒
                </div>
                <div>
                  <strong>Egzersiz yakında eklenecek</strong>
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 4: Video Clip 2 */}
        {currentStep === 4 && (
          <>
            <NarratorSlide
              text="Hiç annen ya da baban sana tarif vermeden yemek yapmanı istedi mi? Ne karmaşa çıkardı değil mi? İşte yapay zeka için de aynısı geçerli! Ona adım adım, sırasıyla ne yapması gerektiğini söylemelisin. Tıpkı bir tarif gibi! Hadi bu videoyu izleyelim!"
              audioSrc="/lessons/unit4-ders1/narration-step4.mp3"
              timingSrc="/lessons/unit4-ders1/narration-step4.json"
            />
            <div className="lesson-video-container">
              <video
                controls
                preload="metadata"
                poster="/lessons/unit4-ders1/clip2-poster.jpg"
                className="lesson-video"
                title="Video: Adım Adım Tarif"
              >
                <source src="/lessons/unit4-ders1/clip2.mp4" type="video/mp4" />
              </video>
            </div>
            <div className="lesson-video-takeaway">
              <strong>Ne öğrendik?</strong>
              <div className="takeaway-rows">
                <p><span className="takeaway-check">&#x2713;</span> <span className="takeaway-good glow">Adım adım</span> = <strong className="takeaway-good">iyi sonuç</strong></p>
                <p><span className="takeaway-cross">&#x2717;</span> <span className="takeaway-bad">Sırasız</span> = <strong className="takeaway-bad">kötü sonuç</strong></p>
              </div>
            </div>
          </>
        )}

        {/* Step 5: Özet */}
        {currentStep === 5 && (
          <>
            <NarratorSlide
              text="Tebrikler, harikasın! Bugün çok önemli üç şey öğrendin. Bir: yapay zekaya her zaman açık ve net konuş. İki: adım adım anlat, tıpkı bir tarif yazar gibi. Üç: detay ver — renk, boyut, şekil gibi ayrıntıları unutma! Bir sonraki derste bu bilgileri kullanarak daha havalı şeyler yapacağız. Görüşmek üzere!"
              audioSrc="/lessons/unit4-ders1/narration-step5.mp3"
              timingSrc="/lessons/unit4-ders1/narration-step5.json"
            />
            <div className="lesson-summary-cards">
              <div className="lesson-summary-item">
                <span className="lesson-summary-icon" aria-hidden="true">
                  🎯
                </span>
                <div>
                  <strong>Açık ve Net Ol</strong>
                  <p>Ne istediğini tam olarak anlat</p>
                </div>
              </div>
              <div className="lesson-summary-item">
                <span className="lesson-summary-icon" aria-hidden="true">
                  📝
                </span>
                <div>
                  <strong>Adım Adım Anlat</strong>
                  <p>Bir tarif yazar gibi sırayla söyle</p>
                </div>
              </div>
              <div className="lesson-summary-item">
                <span className="lesson-summary-icon" aria-hidden="true">
                  🔍
                </span>
                <div>
                  <strong>Detay Ver</strong>
                  <p>Renk, boyut, şekil gibi ayrıntıları ekle</p>
                </div>
              </div>
            </div>
            <p className="lesson-closing">
              Bir sonraki derste bu bilgileri kullanarak daha büyük projeler
              yapacağız!
            </p>
          </>
        )}
      </div>

      {/* Step navigation */}
      <div className="step-nav">
        <button
          type="button"
          className="step-nav-btn secondary"
          onClick={goPrev}
          disabled={isFirst}
          title="Önceki adıma git"
          aria-label="Önceki"
        >
          &larr; Önceki
        </button>

        {isLast ? (
          <a
            href="/student"
            className="step-nav-btn"
            title="Dersi tamamla ve panoya dön"
          >
            Dersi Bitir &rarr;
          </a>
        ) : (
          <button
            type="button"
            className="step-nav-btn"
            onClick={goNext}
            title="Sonraki adıma geç"
            aria-label="Sonraki"
          >
            Sonraki &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
