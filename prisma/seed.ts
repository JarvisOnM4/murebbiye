import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
