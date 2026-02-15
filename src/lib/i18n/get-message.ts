import { messages, type Locale } from "@/lib/i18n/messages";

export function getMessage(locale: Locale, key: keyof (typeof messages)["tr"]) {
  return messages[locale][key];
}
