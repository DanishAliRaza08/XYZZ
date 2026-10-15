export function InfoPage({ title, eyebrow, children, draft }: { title: string; eyebrow?: string; children: React.ReactNode; draft?: boolean }) {
  return (
    <div className="container section">
      <div className="prose">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {draft && (
          <p className="alert alert-warning small">
            Template wording — have this page reviewed by a qualified adviser and completed with your company details before launch.
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
