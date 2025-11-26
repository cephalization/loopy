import { useState, useEffect } from "react";

const ONBOARDING_KEY = "loopy-onboarding-seen";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY);
    if (!hasSeenOnboarding) {
      // Small delay to let the app load first
      const timer = setTimeout(() => setShowOnboarding(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const openOnboarding = () => setShowOnboarding(true);

  return {
    showOnboarding,
    setShowOnboarding,
    openOnboarding,
  };
}

export function markOnboardingSeen() {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

