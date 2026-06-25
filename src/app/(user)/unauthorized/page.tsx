"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import Container from "@/components/Container";
import AccessDenied from "@/components/AccessDenied";

export default function UnauthorizedPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/";
  const signinUrl = `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <Container className="py-10">
      <AccessDenied
        message="Access is denied to view the page. Sign in first."
        buttonText="Sign In"
        buttonHref={signinUrl}
      />
    </Container>
  );
}
