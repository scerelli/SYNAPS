import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc.js";

type WeatherData = {
  temperature: number;
  humidity: number;
  uvIndex: number;
  weatherCode: number;
};

type AqiData = {
  aqi: number;
  pm25: number;
  pm10: number;
};

type CachedData = WeatherData & AqiData;

export const environmentRouter = router({
  current: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;

    const profile = await ctx.prisma.profile.findUnique({
      where: { id: profileId },
      select: { latitude: true, longitude: true },
    });

    if (!profile?.latitude || !profile?.longitude) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Location not configured",
      });
    }

    const { latitude, longitude } = profile;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const cached = await ctx.prisma.environmentCache.findUnique({
      where: {
        latitude_longitude_date_dataType: {
          latitude,
          longitude,
          date: today,
          dataType: "weather",
        },
      },
    });

    if (cached) {
      const data = cached.data as CachedData;
      return { ...data, lat: latitude, lng: longitude };
    }

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,uv_index,weather_code&daily=uv_index_max&timezone=auto&forecast_days=1`,
      ),
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm10,pm2_5,european_aqi&timezone=auto`,
      ),
    ]);

    const [weatherJson, aqiJson] = await Promise.all([
      weatherRes.json() as Promise<{ current?: { temperature_2m?: number; relative_humidity_2m?: number; uv_index?: number; weather_code?: number } }>,
      aqiRes.json() as Promise<{ current?: { european_aqi?: number; pm2_5?: number; pm10?: number } }>,
    ]);

    const data: CachedData = {
      temperature: weatherJson.current?.temperature_2m ?? 0,
      humidity: weatherJson.current?.relative_humidity_2m ?? 0,
      uvIndex: weatherJson.current?.uv_index ?? 0,
      weatherCode: weatherJson.current?.weather_code ?? 0,
      aqi: aqiJson.current?.european_aqi ?? 0,
      pm25: aqiJson.current?.pm2_5 ?? 0,
      pm10: aqiJson.current?.pm10 ?? 0,
    };

    await ctx.prisma.environmentCache.create({
      data: {
        latitude,
        longitude,
        date: today,
        dataType: "weather",
        data,
      },
    });

    return { ...data, lat: latitude, lng: longitude };
  }),
});
