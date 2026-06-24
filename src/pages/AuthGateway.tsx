// src/pages/AuthGateway.tsx
import React from "react";
import { useStore } from "../store/useStore";
import SignInForm from "../components/auth/SignInForm";

interface AuthGatewayProps {
  children: React.ReactNode;
}

const AuthGateway: React.FC<AuthGatewayProps> = ({ children }) => {
  const { isAuthenticated } = useStore();

  if (!isAuthenticated) {
    return <SignInForm />;
  }

  return <>{children}</>;
};

export default AuthGateway;
