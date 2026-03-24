import { RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/api/trpc";

function aqiColor(aqi: number): string {
  if (aqi <= 50) return "text-green-600";
  if (aqi <= 100) return "text-yellow-600";
  if (aqi <= 150) return "text-orange-600";
  return "text-red-600";
}

function aqiBg(aqi: number): string {
  if (aqi <= 50) return "bg-green-50 dark:bg-green-950";
  if (aqi <= 100) return "bg-yellow-50 dark:bg-yellow-950";
  if (aqi <= 150) return "bg-orange-50 dark:bg-orange-950";
  return "bg-red-50 dark:bg-red-950";
}

function StatCard({
  title,
  value,
  unit,
  className,
}: {
  title: string;
  value: number | string;
  unit?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}
          {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function EnvironmentTab() {
  const { data, isLoading, error, refetch, isFetching } = trpc.environment.current.useQuery();

  const isLocationError =
    error?.data?.code === "BAD_REQUEST" && error.message === "Location not configured";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLocationError && (
        <div className="p-4 border rounded-lg text-sm">
          Location not configured.{" "}
          <Link to="/profile" className="text-primary underline underline-offset-2">
            Set your location in Profile
          </Link>{" "}
          to see environmental data.
        </div>
      )}

      {isLoading && !isLocationError && (
        <p className="text-muted-foreground text-sm">Loading...</p>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Temperature" value={data.temperature.toFixed(1)} unit="°C" />
          <StatCard title="Humidity" value={data.humidity} unit="%" />
          <StatCard title="UV Index" value={data.uvIndex.toFixed(1)} />
          <Card className={aqiBg(data.aqi)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">AQI (EU)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${aqiColor(data.aqi)}`}>{data.aqi}</div>
            </CardContent>
          </Card>
          <StatCard title="PM2.5" value={data.pm25.toFixed(1)} unit="μg/m³" />
          <StatCard title="PM10" value={data.pm10.toFixed(1)} unit="μg/m³" />
        </div>
      )}

      {data && (
        <p className="text-xs text-muted-foreground">
          Location: {data.lat.toFixed(4)}, {data.lng.toFixed(4)} · Data from Open-Meteo
        </p>
      )}
    </div>
  );
}
