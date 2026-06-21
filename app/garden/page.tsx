import { ImpactGarden } from '@/components/manna/ImpactGarden';

export const metadata = {
  title: 'garden — Manna',
  description: 'Every generosity round Manna has sent, blooming together.',
};

export default function GardenPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-medium tracking-tight">
          The <span className="text-green">garden</span>
        </h1>
        <p className="mono mt-0.5 text-xs text-muted-foreground">
          bread that didn’t spoil — every round the agent has sent, and why.
        </p>
      </header>
      <ImpactGarden />
    </div>
  );
}
