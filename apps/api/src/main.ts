import { ValidationPipe, type LogLevel } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { config as dotenvConfig } from "dotenv";
import helmet from "helmet";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  dotenvConfig({ path: join(process.cwd(), ".env"), override: true });
  dotenvConfig({ path: join(process.cwd(), "../../.env"), override: true });

  // Toujours exécuter avant NestFactory — même si Railway lance dist/main.js directement.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { bootstrapProdEnv } = require(
    join(__dirname, "..", "scripts", "bootstrap-prod-env.cjs")
  ) as { bootstrapProdEnv: () => void };
  bootstrapProdEnv();

  // En staging/production, on supprime les logs de démarrage NestJS (RoutesResolver /
  // RouterExplorer), qui génèrent +500 messages au boot et déclenchent le rate-limit Railway.
  // Les logs applicatifs (warn, error) restent actifs dans tous les environnements.
  const appEnv = (process.env.APP_ENV ?? "").toLowerCase();
  const isDeployed = appEnv === "staging" || appEnv === "production";
  const logLevels: LogLevel[] = isDeployed
    ? ["error", "warn"]
    : ["error", "warn", "log", "debug", "verbose"];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels
  });
  /** Express 5 : parser simple par defaut ; conserver le comportement type qs (objets / tableaux). */
  app.set("query parser", "extended");

  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy === "1" || trustProxy === "true") {
    const httpServer = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: unknown) => void;
    };
    httpServer.set("trust proxy", 1);
  }

  // Headers de sécurité HTTP (CSP, HSTS, X-Frame-Options, etc.)
  app.use(helmet({ contentSecurityPolicy: false }));

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // Rejette les champs inconnus au lieu de les ignorer silencieusement
      transform: true,
      transformOptions: { enableImplicitConversion: false }
    })
  );

  const defaultCorsOrigins = [
    "http://localhost:3001",
    "http://127.0.0.1:3001"
  ];
  const corsOrigins =
    process.env.CORS_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? defaultCorsOrigins;

  app.enableCors({
    origin: corsOrigins,
    credentials: true
  });

  const port =
    Number(process.env.PORT ?? process.env.API_PORT) || 3000;
  const host = process.env.API_HOST || "0.0.0.0";
  await app.listen(port, host);
  console.log(
    `[bootstrap] API en écoute sur ${host}:${port} (APP_ENV=${process.env.APP_ENV ?? "—"})`
  );
}

void bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error("[bootstrap] Échec fatal au démarrage:", message);
  process.exit(1);
});
