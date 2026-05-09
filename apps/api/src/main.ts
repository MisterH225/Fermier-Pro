import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { config as dotenvConfig } from "dotenv";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  dotenvConfig({ path: join(process.cwd(), ".env"), override: true });
  dotenvConfig({ path: join(process.cwd(), "../../.env"), override: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  /** Express 5 : parser simple par defaut ; conserver le comportement type qs (objets / tableaux). */
  app.set("query parser", "extended");

  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy === "1" || trustProxy === "true") {
    const httpServer = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: unknown) => void;
    };
    httpServer.set("trust proxy", 1);
  }

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
}

void bootstrap();
