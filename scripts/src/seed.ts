import { db } from "@workspace/db";
import {
  usersTable, coursesTable, modulesTable, lessonsTable,
  platformSettingsTable, notificationsTable, referralsTable,
  enrollmentsTable, paymentsTable, couponsTable
} from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  const adminPass = await bcrypt.hash("Admin@12345", 10);
  const studentPass = await bcrypt.hash("Student@12345", 10);

  const [admin] = await db.insert(usersTable).values({
    email: "admin@edupro.com",
    password: adminPass,
    name: "Alex Admin",
    role: "admin",
    referralCode: "ADMIN001",
    isBanned: false,
  }).onConflictDoNothing().returning();

  const [student] = await db.insert(usersTable).values({
    email: "alice@edupro.com",
    password: studentPass,
    name: "Alice Johnson",
    role: "student",
    referralCode: "ALICE001",
    isBanned: false,
  }).onConflictDoNothing().returning();

  const [affiliate] = await db.insert(usersTable).values({
    email: "bob@edupro.com",
    password: studentPass,
    name: "Bob Smith",
    role: "affiliate",
    referralCode: "BOBSMT01",
    isBanned: false,
  }).onConflictDoNothing().returning();

  console.log("Users seeded");

  const courses = await db.insert(coursesTable).values([
    {
      title: "Affiliate Marketing Mastery 2024",
      description: "Learn how to build a 6-figure affiliate marketing business from scratch. This comprehensive course covers everything from niche selection to traffic generation and scaling your income.",
      thumbnailUrl: null,
      price: "197.00",
      category: "Affiliate Marketing",
      level: "beginner",
      status: "published",
      durationMinutes: 480,
    },
    {
      title: "E-commerce Empire: Build & Scale",
      description: "Build a profitable e-commerce store from zero to $10k/month. Covers product research, store setup, Facebook ads, and scaling strategies used by 7-figure store owners.",
      thumbnailUrl: null,
      price: "297.00",
      category: "E-commerce",
      level: "intermediate",
      status: "published",
      durationMinutes: 600,
    },
    {
      title: "Dropshipping Accelerator Program",
      description: "Launch your dropshipping business in 30 days. Learn supplier sourcing, product validation, automated fulfillment, and customer acquisition strategies.",
      thumbnailUrl: null,
      price: "147.00",
      category: "Dropshipping",
      level: "beginner",
      status: "published",
      durationMinutes: 360,
    },
    {
      title: "Advanced Facebook Ads for E-commerce",
      description: "Master Facebook and Instagram advertising to scale your online business. Advanced targeting, retargeting funnels, and creative strategies for maximum ROAS.",
      thumbnailUrl: null,
      price: "247.00",
      category: "E-commerce",
      level: "advanced",
      status: "published",
      durationMinutes: 420,
    },
    {
      title: "SEO for Affiliate Marketers",
      description: "Drive free organic traffic to your affiliate offers. Learn keyword research, on-page SEO, link building, and content strategies that rank and convert.",
      thumbnailUrl: null,
      price: "127.00",
      category: "Affiliate Marketing",
      level: "intermediate",
      status: "draft",
      durationMinutes: 300,
    },
  ]).onConflictDoNothing().returning();

  console.log("Courses seeded:", courses.length);

  if (courses.length > 0) {
    const course1 = courses[0];
    const modules1 = await db.insert(modulesTable).values([
      { courseId: course1.id, title: "Getting Started with Affiliate Marketing", order: 1 },
      { courseId: course1.id, title: "Finding Your Niche", order: 2 },
      { courseId: course1.id, title: "Building Your Traffic Engine", order: 3 },
    ]).returning();

    for (const mod of modules1) {
      await db.insert(lessonsTable).values([
        { moduleId: mod.id, title: "What is Affiliate Marketing?", type: "video", durationMinutes: 15, order: 1, isFree: "true", content: "Introduction to affiliate marketing concepts" },
        { moduleId: mod.id, title: "How Commission Structures Work", type: "video", durationMinutes: 20, order: 2, isFree: "false", content: "Deep dive into affiliate commission structures" },
        { moduleId: mod.id, title: "Tools & Resources", type: "pdf", durationMinutes: 5, order: 3, isFree: "false", content: "Essential tools list" },
      ]);
    }

    if (courses[1]) {
      const modules2 = await db.insert(modulesTable).values([
        { courseId: courses[1].id, title: "E-commerce Fundamentals", order: 1 },
        { courseId: courses[1].id, title: "Product Research & Selection", order: 2 },
      ]).returning();
      for (const mod of modules2) {
        await db.insert(lessonsTable).values([
          { moduleId: mod.id, title: "Introduction to E-commerce", type: "video", durationMinutes: 18, order: 1, isFree: "true" },
          { moduleId: mod.id, title: "Choosing Your Platform", type: "video", durationMinutes: 25, order: 2, isFree: "false" },
        ]);
      }
    }

    if (courses[2]) {
      const modules3 = await db.insert(modulesTable).values([
        { courseId: courses[2].id, title: "Dropshipping Basics", order: 1 },
        { courseId: courses[2].id, title: "Finding Suppliers", order: 2 },
      ]).returning();
      for (const mod of modules3) {
        await db.insert(lessonsTable).values([
          { moduleId: mod.id, title: "What is Dropshipping?", type: "video", durationMinutes: 12, order: 1, isFree: "true" },
          { moduleId: mod.id, title: "Setting Up Your Store", type: "video", durationMinutes: 30, order: 2, isFree: "false" },
        ]);
      }
    }
  }

  await db.insert(platformSettingsTable).values({
    siteName: "EduPro",
    siteDescription: "Master affiliate marketing, e-commerce, and dropshipping with industry experts",
    commissionRate: 20,
    currency: "USD",
    stripeEnabled: true,
    razorpayEnabled: false,
    emailNotificationsEnabled: true,
  }).onConflictDoNothing();

  await db.insert(couponsTable).values([
    { code: "WELCOME20", discountType: "percentage", discountValue: "20", isActive: true },
    { code: "SAVE50", discountType: "fixed", discountValue: "50", isActive: true },
  ]).onConflictDoNothing();

  if (student) {
    await db.insert(notificationsTable).values([
      { userId: student.id, title: "Welcome to EduPro!", message: "Your account has been created. Browse our courses to get started.", type: "success" },
      { userId: student.id, title: "Special Offer!", message: "Use code WELCOME20 for 20% off your first course.", type: "info" },
    ]);

    if (courses.length > 0) {
      await db.insert(enrollmentsTable).values({ userId: student.id, courseId: courses[0].id }).onConflictDoNothing();
      await db.insert(paymentsTable).values({
        userId: student.id,
        courseId: courses[0].id,
        amount: "157.60",
        currency: "USD",
        status: "completed",
        gateway: "stripe",
        sessionId: "sim_seed_001",
        couponCode: "WELCOME20",
      }).onConflictDoNothing();
    }
  }

  if (affiliate && student && courses.length > 0) {
    await db.insert(referralsTable).values([
      { referrerId: affiliate.id, referredUserId: student.id, courseId: courses[0].id, status: "purchase", commission: "39.40" },
      { referrerId: affiliate.id, courseId: null, status: "click" },
      { referrerId: affiliate.id, courseId: null, status: "click" },
    ]);
    await db.insert(notificationsTable).values([
      { userId: affiliate.id, title: "Commission Earned!", message: "You earned $39.40 from a referral purchase.", type: "success" },
    ]);
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
