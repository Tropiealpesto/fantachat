import Link from "next/link";

export type LegalSection = {
  title: string;
  body: string[];
};

type Props = {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  note?: string;
};

export default function LegalPage({ eyebrow, title, updated, intro, sections, note }: Props) {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-header">
          <Link href="/" className="legal-brand" aria-label="Torna alla home">
            <span>Fanta</span>
            <strong>Chat</strong>
          </Link>
          <nav className="legal-nav" aria-label="Documenti legali">
            <Link href="/privacy">Privacy</Link>
            <Link href="/termini">Termini</Link>
            <Link href="/cancellazione-account">Account</Link>
          </nav>
        </header>

        <section className="legal-hero">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>Aggiornato: {updated}</span>
        </section>

        <section className="legal-card legal-intro">
          <p>{intro}</p>
          {note && <div className="legal-note">{note}</div>}
        </section>

        {sections.map((section) => (
          <section key={section.title} className="legal-card">
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
