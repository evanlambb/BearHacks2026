"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NewScoutPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [therapeuticArea, setTherapeuticArea] = useState("Oncology");
  const [moleculeType, setMoleculeType] = useState("Small Molecule");
  const [region, setRegion] = useState("United States");
  const [loeStart, setLoeStart] = useState("2027-01-01");
  const [loeEnd, setLoeEnd] = useState("2029-12-31");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const filter = {
      therapeuticArea,
      moleculeType,
      loeWindowStart: loeStart,
      loeWindowEnd: loeEnd,
      region,
    };
    try {
      window.sessionStorage.setItem(
        "pharma-scout:filter",
        JSON.stringify(filter)
      );
    } catch {
      // sessionStorage unavailable (private mode etc.) — dossier page will
      // fall back to its default filter.
    }
    router.push("/scouts/run");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to scouts
      </Link>

      <Card className="border-border/60 bg-card/40 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            <span>New scout</span>
          </div>
          <CardTitle className="text-2xl tracking-tight">
            Define your search
          </CardTitle>
          <CardDescription>
            The scout will scan the FDA Orange Book and surface the strongest
            qualifying asset, then build a complete opportunity dossier.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="ta">Therapeutic area</Label>
              <Select
                value={therapeuticArea}
                onValueChange={setTherapeuticArea}
              >
                <SelectTrigger id="ta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Oncology">Oncology</SelectItem>
                  <SelectItem value="Cardiovascular">Cardiovascular</SelectItem>
                  <SelectItem value="CNS">CNS / Neurology</SelectItem>
                  <SelectItem value="Immunology">Immunology</SelectItem>
                  <SelectItem value="Metabolic">Metabolic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mol">Molecule type</Label>
              <Select value={moleculeType} onValueChange={setMoleculeType}>
                <SelectTrigger id="mol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Small Molecule">Small Molecule</SelectItem>
                  <SelectItem value="Biologic">Biologic</SelectItem>
                  <SelectItem value="Peptide">Peptide</SelectItem>
                  <SelectItem value="Oligonucleotide">
                    Oligonucleotide
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="loe-start">LoE window start</Label>
                <Input
                  id="loe-start"
                  type="date"
                  value={loeStart}
                  onChange={(e) => setLoeStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="loe-end">LoE window end</Label>
                <Input
                  id="loe-end"
                  type="date"
                  value={loeEnd}
                  onChange={(e) => setLoeEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="region">Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger id="region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="European Union">European Union</SelectItem>
                  <SelectItem value="Japan">Japan</SelectItem>
                  <SelectItem value="Worldwide">Worldwide</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="mt-2 gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deploying scout...
                </>
              ) : (
                <>
                  Deploy Scout
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
