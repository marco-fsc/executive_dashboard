"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    // Wait for fonts and images to render before triggering print
    const timer = setTimeout(() => {
      window.print();
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
