# Puente de Señas

App web instalable para conversar entre lengua de señas y voz.

- **Entender:** la cámara sigue las manos y reconoce las señas que se le han enseñado; arma la frase y la lee en voz alta.
- **Responder:** se escribe o se dicta la respuesta y la app la muestra seña por seña con los videos guardados.
- **Mis señas:** cada seña se enseña grabándola cinco veces. La app no trae señas de fábrica.

Todo ocurre en el dispositivo: el video no se envía a ningún servidor.

El reconocimiento de manos usa MediaPipe Hand Landmarker (Apache 2.0), incluido en `lib/`. Tipografías Bricolage Grotesque y Figtree (SIL Open Font License) en `fonts/`.
