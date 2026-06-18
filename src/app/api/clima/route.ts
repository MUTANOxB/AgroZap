import { NextRequest, NextResponse } from "next/server";
import type { ClimaErrorResponse, ClimaResponse } from "@/types/clima";

export const revalidate = 1800;

type GeocodingResult = {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
};

type ForecastResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  hourly?: {
    time?: string[];
    precipitation_probability?: Array<number | null>;
    precipitation?: Array<number | null>;
  };
  daily?: {
    time?: string[];
    precipitation_probability_max?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
    weather_code?: Array<number | null>;
  };
};

/*
 * Os códigos numéricos da Open-Meteo são convertidos aqui para textos claros
 * em português antes de a resposta chegar aos componentes.
 */
function traduzirCondicao(code: number | undefined) {
  if (code === 0) return "Céu limpo";
  if (code === 1 || code === 2 || code === 3) return "Parcialmente nublado";
  if (code === 45 || code === 48) return "Neblina";
  if (code === 51 || code === 53 || code === 55) return "Garoa";
  if (code === 56 || code === 57) return "Garoa congelante";
  if (code === 61 || code === 63 || code === 65) return "Chuva";
  if (code === 66 || code === 67) return "Chuva congelante";
  if (code === 71 || code === 73 || code === 75 || code === 77) return "Neve";
  if (code === 80 || code === 81 || code === 82) return "Pancadas de chuva";
  if (code === 85 || code === 86) return "Pancadas de neve";
  if (code === 95 || code === 96 || code === 99) return "Trovoadas";
  return "Condição não informada";
}

function montarAviso(
  chanceAmanha: number | null,
  chuvaAmanha: number | null,
) {
  if (chuvaAmanha !== null && chuvaAmanha >= 10) {
    return "Previsão de chuva forte amanhã. Planeje as atividades no campo.";
  }

  if (chuvaAmanha !== null && chuvaAmanha >= 2) {
    return "Previsão de chuva amanhã.";
  }

  if (chuvaAmanha !== null && chuvaAmanha > 0) {
    return "Previsão de chuva leve amanhã.";
  }

  if (chanceAmanha !== null && chanceAmanha >= 50) {
    return "Há chance de chuva amanhã.";
  }

  if (chanceAmanha !== null && chanceAmanha < 20) {
    return "Baixa chance de chuva amanhã.";
  }

  return null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/*
 * A rota primeiro transforma o nome da cidade em latitude e longitude. Depois
 * usa essas coordenadas para pedir a previsão à Open-Meteo e devolver ao
 * frontend somente o JSON simples de que o AgroZap precisa.
 */
export async function GET(request: NextRequest) {
  const cidade =
    request.nextUrl.searchParams.get("cidade")?.trim().slice(0, 80) ||
    "Rio Verde";
  const estado =
    request.nextUrl.searchParams.get("estado")?.trim().slice(0, 30) || "GO";

  try {
    const geocodingUrl = new URL(
      "https://geocoding-api.open-meteo.com/v1/search",
    );
    geocodingUrl.searchParams.set("name", cidade);
    geocodingUrl.searchParams.set("count", "10");
    geocodingUrl.searchParams.set("language", "pt");
    geocodingUrl.searchParams.set("format", "json");
    geocodingUrl.searchParams.set("countryCode", "BR");

    const geocodingResponse = await fetch(geocodingUrl, {
      next: { revalidate: 86400 },
    });

    if (!geocodingResponse.ok) {
      throw new Error("Falha ao localizar a cidade.");
    }

    const geocodingData = (await geocodingResponse.json()) as {
      results?: GeocodingResult[];
    };
    const locations = geocodingData.results ?? [];
    const normalizedState = estado.toLocaleLowerCase("pt-BR");
    const location =
      locations.find((item) =>
        item.admin1?.toLocaleLowerCase("pt-BR").includes(normalizedState),
      ) ?? locations[0];

    if (!location) {
      return NextResponse.json<ClimaErrorResponse>(
        { sucesso: false, erro: "Cidade não encontrada." },
        { status: 404 },
      );
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(location.latitude));
    forecastUrl.searchParams.set("longitude", String(location.longitude));
    forecastUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "wind_speed_10m",
        "weather_code",
      ].join(","),
    );
    forecastUrl.searchParams.set(
      "hourly",
      "precipitation_probability,precipitation",
    );
    forecastUrl.searchParams.set(
      "daily",
      "precipitation_probability_max,precipitation_sum,weather_code",
    );
    forecastUrl.searchParams.set("timezone", "America/Sao_Paulo");
    forecastUrl.searchParams.set("forecast_days", "3");

    const forecastResponse = await fetch(forecastUrl, {
      next: { revalidate: 1800 },
    });

    if (!forecastResponse.ok) {
      throw new Error("Falha ao consultar a previsão.");
    }

    const forecast = (await forecastResponse.json()) as ForecastResponse;
    const currentTime = forecast.current?.time;
    const currentHourIndex = currentTime
      ? forecast.hourly?.time?.indexOf(currentTime) ?? -1
      : -1;
    const hourlyChance =
      currentHourIndex >= 0
        ? nullableNumber(
            forecast.hourly?.precipitation_probability?.[currentHourIndex],
          )
        : null;
    const chanceHoje =
      hourlyChance ??
      nullableNumber(forecast.daily?.precipitation_probability_max?.[0]);
    const chuvaHoje = nullableNumber(forecast.daily?.precipitation_sum?.[0]);
    const chanceAmanha = nullableNumber(
      forecast.daily?.precipitation_probability_max?.[1],
    );
    const chuvaAmanha = nullableNumber(forecast.daily?.precipitation_sum?.[1]);

    const response: ClimaResponse = {
      sucesso: true,
      local: `${location.name}, ${estado.toUpperCase()}`,
      temperatura: nullableNumber(forecast.current?.temperature_2m),
      sensacao: nullableNumber(forecast.current?.apparent_temperature),
      condicao: traduzirCondicao(forecast.current?.weather_code),
      umidade: nullableNumber(forecast.current?.relative_humidity_2m),
      vento: nullableNumber(forecast.current?.wind_speed_10m),
      chanceChuva: chanceHoje,
      chuvaPrevista: chuvaHoje,
      aviso: montarAviso(chanceAmanha, chuvaAmanha),
      atualizadoEm: currentTime ?? new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json<ClimaErrorResponse>(
      {
        sucesso: false,
        erro: "Não foi possível consultar o clima no momento.",
      },
      { status: 502 },
    );
  }
}
