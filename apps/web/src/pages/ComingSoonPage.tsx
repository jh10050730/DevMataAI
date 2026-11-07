import type { LucideIcon } from 'lucide-react';
import { Card } from '../components/ui';

export default function ComingSoonPage({ icon: Icon, title, phase, description }: { icon: LucideIcon; title: string; phase: number; description: string }) {
  return (
    <Card className="py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-gradient-to-br from-blue-600/15 to-violet-600/15 p-4">
          <Icon className="size-7 text-blue-500" />
        </div>
        <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">Phase {phase} 예정</span>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-md text-sm text-muted">{description}</p>
      </div>
    </Card>
  );
}
