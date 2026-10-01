# Versiones y builds

## Números

- **Versión** (`1.1.0`): la que ve la gente en la App Store. Vive en
  `app.json` (`expo.version`) y en `store.config.json` (`apple.version`); un
  test comprueba que coinciden.
- **Build** (`5`): la pone EAS sola en cada build de producción
  (`appVersionSource: "remote"` y `autoIncrement` en `eas.json`).
- Mientras una versión está en revisión de Apple, lo nuevo va en la
  siguiente versión (por ejemplo la 1.1.0 en TestFlight con la 1.0.0 en
  revisión).

## Etiquetas en git

Cada build que sube a App Store Connect tiene una etiqueta anotada:

```
v<versión>-build.<build>        p. ej. v1.1.0-build.5
```

- Apunta al commit que compiló EAS, o a uno que solo añade documentación
  encima.
- Su mensaje es la entrada de esa build en [CHANGELOG.md](../CHANGELOG.md).
- En GitHub salen en *Tags*; desde ahí se puede crear la *Release* con un
  clic (o con `gh release create` si está instalado).

## Paso a paso

1. Si es versión nueva, subirla en `app.json` y `store.config.json`, y
   `npm run store:md`.
2. Pasar lo de **Sin publicar** del `CHANGELOG.md` a una entrada nueva con la
   versión, la fecha y el destino (TestFlight o revisión).
3. Tests: `npm test` y `npm run test:rules`.
4. Commit y build:
   ```bash
   npx eas-cli build --profile production --platform ios --auto-submit
   ```
   EAS imprime el número de build y el enlace a los logs: añadirlos al
   `CHANGELOG.md` y hacer commit.
5. Etiqueta y push:
   ```bash
   git tag -a v1.1.0-build.5 -F <notas>.md
   git push origin <rama> v1.1.0-build.5
   ```

## Historial

| Versión | Build | Etiqueta | Destino |
|---|---|---|---|
| 1.1.0 | 6 | `v1.1.0-build.6` | TestFlight (pagos con Stripe en modo test, administración) |
| 1.1.0 | 5 | `v1.1.0-build.5` | TestFlight (prueba interna de pagos, fase 1) |
| 1.0.0 | 4 | `v1.0.0-build.4` | Revisión de App Store |
| 1.0.0 | 3 | — | TestFlight |
