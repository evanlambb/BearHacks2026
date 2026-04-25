import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Block 1 smoke test
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Pharma Scout</h1>
        <p className="max-w-md text-muted-foreground">
          If this button is teal and the background is near-black, the theme is
          wired up correctly.
        </p>
        <Button size="lg">Deploy New Scout</Button>
      </div>
    </main>
  );
}
