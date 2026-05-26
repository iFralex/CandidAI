"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const STORAGE_KEY = "cookie-banner-dismissed";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "1") {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-md shadow-xl p-4 text-sm text-gray-200"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss cookie notice"
        className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="pr-6 leading-relaxed">
        We use technical and analytics cookies to operate this site and improve your experience. By continuing to browse, you accept this use. Read our{" "}
        <Link href="/docs/cookie-policy" className="underline hover:text-white">
          Cookie Policy
        </Link>
        .
      </p>
      <div className="mt-3 flex justify-end">
        <button
          onClick={dismiss}
          className="px-4 py-1.5 rounded-md bg-white text-gray-900 font-medium text-sm hover:bg-gray-100 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
