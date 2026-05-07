import { AppRoutePulseFallback } from "@/components/app/AppRoutePulseFallback";

/** Replaces full-viewport spinner — structure + pulse only. */
export default function AppSegmentLoading() {
  return <AppRoutePulseFallback />;
}
