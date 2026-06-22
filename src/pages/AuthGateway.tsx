import React from "react";
import { useStore } from "../store";
import SignInForm from "../components/auth/SignInForm";
import SignUpWizard from "../components/auth/SignUpWizard";

export default function AuthGateway({ children }: { children: React.ReactNode }) {
  const { currentUser, companySettings } = useStore();

  if (!companySettings.companyNameEn) {
    return <SignUpWizard />;
  }

  if (!currentUser) {
    // Render the standard SignInForm directly to ensure single login UI across the app
    return <SignInForm />;
  }

  return <>{children}</>;
}
