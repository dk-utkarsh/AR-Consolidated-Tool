import { Card, CardContent, CardTitle } from "@/components/ui/card";

interface MetricProps {
  label: string;
  value: string;
}

export function Metric({ label, value }: MetricProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <CardTitle>{label}</CardTitle>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
