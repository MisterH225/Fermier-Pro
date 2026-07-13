import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { AppService } from "./app.service";

@Controller()
@SkipThrottle()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("health")
  async health() {
    const result = await this.appService.health();
    if (result.status === "error") {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

  @Get("health/db")
  async healthDb() {
    return this.appService.healthWithDb();
  }

  /**
   * Page web légère pour les QR HTTPS : redirige vers le schéma mobile
   * `fermier-pro://invite/:token` (caméra système ou navigateur).
   */
  @Get("invite/:token")
  @Header("Content-Type", "text/html; charset=utf-8")
  inviteRedirect(@Param("token") rawToken: string): string {
    const token = rawToken.trim();
    if (!/^[a-f0-9]{32,64}$/i.test(token)) {
      throw new NotFoundException();
    }
    const encoded = encodeURIComponent(token);
    const deepLink = `fermier-pro://invite/${encoded}`;
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fermier Pro — invitation</title>
  <meta http-equiv="refresh" content="0;url=${deepLink}" />
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; text-align: center; color: #1B3B2E; }
    a { color: #2F9E44; font-weight: 600; }
  </style>
</head>
<body>
  <p>Ouverture de Fermier Pro…</p>
  <p><a href="${deepLink}">Ouvrir l'application</a></p>
  <script>window.location.replace(${JSON.stringify(deepLink)});</script>
</body>
</html>`;
  }
}
