import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

/** Legacy `/p/{slug}` URLs redirect to canonical `/plans/{slug}`. */
export default async function LegacyPublicTripRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/plans/${slug}`);
}
