import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "./card";

interface ErrorCardProps {
  message: string;
  title?: string;
}

export function ErrorCard({
  title = "Failed to load",
  message,
}: ErrorCardProps) {
  return (
    <Card className="border-copper-dim/60" role="alert">
      <CardContent className="flex items-center gap-3 py-6">
        <AlertTriangle className="size-5 shrink-0 text-copper" />
        <div>
          <p className="font-medium text-text-primary">{title}</p>
          <p className="text-sm text-text-secondary">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
