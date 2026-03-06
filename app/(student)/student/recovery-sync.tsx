"use client";

import { useEffect } from "react";

export function RecoverySync({ code }: { code: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem("recoveryCode", code);
    } catch {
      // sessionStorage unavailable
    }
  }, [code]);

  return null;
}
