"use client";

import { use } from "react";
import { TourClient } from "./TourClient";

export default function TourPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <TourClient code={decodeURIComponent(code).toUpperCase()} />;
}
