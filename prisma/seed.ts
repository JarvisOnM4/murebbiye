import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, DrawingExerciseStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: "app.default_locale" },
    update: { value: "tr" },
    create: { key: "app.default_locale", value: "tr" },
  });

  await prisma.systemSetting.upsert({
    where: { key: "lesson.duration_minutes" },
    update: { value: 35 },
    create: { key: "lesson.duration_minutes", value: 35 },
  });

  await prisma.systemSetting.upsert({
    where: { key: "budget.mode_at_80" },
    update: { value: "short_response_low_cost_model" },
    create: { key: "budget.mode_at_80", value: "short_response_low_cost_model" },
  });

  await prisma.systemSetting.upsert({
    where: { key: "budget.mode_at_100" },
    update: { value: "stop_new_generation_review_only" },
    create: { key: "budget.mode_at_100", value: "stop_new_generation_review_only" },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const studentEmail = process.env.SEED_STUDENT_EMAIL?.toLowerCase().trim();
  const studentPassword = process.env.SEED_STUDENT_PASSWORD;

  if (adminEmail && adminPassword) {
    const adminHash = await bcrypt.hash(adminPassword, 12);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash: adminHash,
        role: UserRole.ADMIN,
      },
      create: {
        email: adminEmail,
        passwordHash: adminHash,
        role: UserRole.ADMIN,
      },
    });
  }

  if (studentEmail && studentPassword) {
    const studentHash = await bcrypt.hash(studentPassword, 12);

    await prisma.user.upsert({
      where: { email: studentEmail },
      update: {
        passwordHash: studentHash,
        role: UserRole.STUDENT,
        nickname: process.env.SEED_STUDENT_NICKNAME ?? "Pilot Student",
        parentEmail: process.env.SEED_STUDENT_PARENT_EMAIL ?? null,
      },
      create: {
        email: studentEmail,
        passwordHash: studentHash,
        role: UserRole.STUDENT,
        nickname: process.env.SEED_STUDENT_NICKNAME ?? "Pilot Student",
        parentEmail: process.env.SEED_STUDENT_PARENT_EMAIL ?? null,
      },
    });
  }
}

async function seedDrawingExercises() {
  const blueCabrioSpec = {
    targetDescription:
      "A blue convertible car with a boy driving and a girl as passenger. A dog in the back seat with ears blowing in the wind. Sunny day.",
    elements: [
      {
        id: "car",
        labelTr: "Araba",
        category: "required",
        detectionHints: ["araba", "araç", "otomobil"],
        activatesLayers: ["car-body-grey"],
      },
      {
        id: "car_type",
        labelTr: "Üstü açık araba",
        category: "required",
        detectionHints: ["üstü açık", "cabrio", "kabriyole", "convertible", "açık tavan"],
        activatesLayers: ["car-convertible"],
        dependsOn: "car",
      },
      {
        id: "car_color",
        labelTr: "Mavi renk",
        category: "required",
        detectionHints: ["mavi", "blue"],
        activatesLayers: ["car-color-blue"],
        dependsOn: "car",
      },
      {
        id: "boy",
        labelTr: "Erkek çocuk",
        category: "required",
        detectionHints: ["erkek", "oğlan", "çocuk süren", "sürücü"],
        activatesLayers: ["passenger-boy"],
      },
      {
        id: "girl",
        labelTr: "Kız çocuk",
        category: "required",
        detectionHints: ["kız", "kız çocuk"],
        activatesLayers: ["passenger-girl"],
      },
      {
        id: "dog",
        labelTr: "Köpek",
        category: "required",
        detectionHints: ["köpek", "hayvan"],
        activatesLayers: ["dog-base"],
      },
      {
        id: "dog_ears",
        labelTr: "Köpeğin kulakları rüzgarda",
        category: "bonus",
        detectionHints: ["kulak", "rüzgar", "savrulan"],
        activatesLayers: ["dog-ears-wind"],
        dependsOn: "dog",
      },
    ],
    layers: [
      {
        id: "background",
        imageKey: "exercises/blue-cabrio/bg.png",
        zIndex: 0,
        defaultVisible: true,
      },
      {
        id: "road",
        imageKey: "exercises/blue-cabrio/road.png",
        zIndex: 1,
        defaultVisible: true,
      },
      {
        id: "car-body-grey",
        imageKey: "exercises/blue-cabrio/car-grey.png",
        zIndex: 10,
        defaultVisible: false,
      },
      {
        id: "car-convertible",
        imageKey: "exercises/blue-cabrio/car-convertible.png",
        zIndex: 10,
        defaultVisible: false,
        mutuallyExclusive: ["car-body-grey"],
      },
      {
        id: "car-color-blue",
        imageKey: "exercises/blue-cabrio/car-blue-overlay.png",
        zIndex: 11,
        defaultVisible: false,
      },
      {
        id: "passenger-boy",
        imageKey: "exercises/blue-cabrio/boy.png",
        zIndex: 20,
        defaultVisible: false,
      },
      {
        id: "passenger-girl",
        imageKey: "exercises/blue-cabrio/girl.png",
        zIndex: 21,
        defaultVisible: false,
      },
      {
        id: "dog-base",
        imageKey: "exercises/blue-cabrio/dog.png",
        zIndex: 22,
        defaultVisible: false,
      },
      {
        id: "dog-ears-wind",
        imageKey: "exercises/blue-cabrio/dog-ears.png",
        zIndex: 23,
        defaultVisible: false,
      },
    ],
    clues: [
      {
        elementId: "car_type",
        order: 1,
        highlightArea: { x: 20, y: 30, width: 60, height: 40 },
        hintTextTr: "Arabanın üstüne dikkat et! Normal bir araba mı?",
      },
      {
        elementId: "car_color",
        order: 2,
        highlightArea: { x: 25, y: 35, width: 50, height: 30 },
        hintTextTr: "Arabanın rengi ne?",
      },
      {
        elementId: "boy",
        order: 3,
        highlightArea: { x: 35, y: 25, width: 15, height: 30 },
        hintTextTr: "Arabada kim var? Sürücüye bak!",
      },
      {
        elementId: "girl",
        order: 4,
        highlightArea: { x: 50, y: 25, width: 15, height: 30 },
        hintTextTr: "Yolcu koltuğunda kim oturuyor?",
      },
      {
        elementId: "dog",
        order: 5,
        highlightArea: { x: 55, y: 20, width: 20, height: 25 },
        hintTextTr: "Arka koltukta bir misafir daha var!",
      },
    ],
  };

  await prisma.drawingExercise.upsert({
    where: { slug: "mavi-cabrio" },
    update: {
      templateSpec: blueCabrioSpec,
      status: DrawingExerciseStatus.ACTIVE,
    },
    create: {
      slug: "mavi-cabrio",
      titleTr: "Mavi Kabriyole",
      titleEn: "Blue Convertible",
      descriptionTr:
        "Hedef resmi AI'ya tarif et! Tarif ettiğin unsurlar çizime yansıyacak.",
      unitNumber: 4,
      lessonNumber: 1,
      targetImageKey: "exercises/blue-cabrio/target.png",
      templateSpec: blueCabrioSpec,
      generationMode: "template",
      status: DrawingExerciseStatus.ACTIVE,
      maxAttempts: 20,
    },
  });

  console.log("Drawing exercise seed complete: mavi-cabrio");
}

main()
  .then(async () => {
    await seedDrawingExercises();
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
