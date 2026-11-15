# Puente de Señas

App web instalable para conversar entre lengua de señas y voz.

- **Entender:** la cámara sigue las manos y reconoce las señas que se le han enseñado; arma la frase y la lee en voz alta.
- **Responder:** se escribe o se dicta la respuesta y la app la muestra seña por seña con los videos guardados.
- **Diccionario incluido:** 50 señas básicas de la Lengua de Señas Colombiana en video (`senas/`), tomadas del conjunto de datos LSC50, licencia CC BY 4.0. Créditos y cambios en `senas/CREDITOS.txt`. Sirven para responder; la cámara no las reconoce todavía.
- **Mis señas:** cada seña nueva se enseña grabándola cinco veces; queda disponible para responder y para reconocerla.

Todo ocurre en el dispositivo: el video no se envía a ningún servidor.

El reconocimiento de manos usa MediaPipe Hand Landmarker (Apache 2.0), incluido en `lib/`. Tipografías Bricolage Grotesque y Figtree (SIL Open Font License) en `fonts/`.
