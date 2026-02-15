export const messages = {
  tr: {
    appTitle: "murebbiye",
    statusReady: "Hazir",
    adminPanel: "Yonetici Paneli",
    studentPanel: "Ogrenci Paneli"
  },
  en: {
    appTitle: "murebbiye",
    statusReady: "Ready",
    adminPanel: "Admin Panel",
    studentPanel: "Student Panel"
  }
} as const;

export type Locale = keyof typeof messages;
