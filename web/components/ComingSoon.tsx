type ComingSoonProps = {
  title: string;
};

export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <main className="workspace-page bg-canvas">
      <header className="mb-6 border-b border-line pb-5">
        <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">{title}</h1>
      </header>
      <p className="font-body-md text-body-md text-on-surface-variant">
        Coming soon. This area is not implemented in the mock demo.
      </p>
    </main>
  );
}
