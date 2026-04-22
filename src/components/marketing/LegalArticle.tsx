import Link from "next/link";

type Props = {
  title: string;
  children: React.ReactNode;
};

export function LegalArticle({ title, children }: Props) {
  return (
    <main className="bg-transparent px-4 py-12 pb-24">
      <article className="mx-auto max-w-[760px]">
        <Link
          href="/"
          className="font-sans text-sm font-medium text-royal/70 underline-offset-2 hover:text-gold"
        >
          ← Home
        </Link>
        <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-royal md:text-4xl">
          {title}
        </h1>
        <div className="mt-10 space-y-8 font-sans text-[15px] leading-relaxed text-royal/90 [&_a]:text-royal [&_a]:underline [&_h2]:scroll-mt-24 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-royal [&_h3]:mt-4 [&_h3]:font-sans [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-royal/60 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </article>
    </main>
  );
}
