# Puente de Señas

App web instalable para conversar entre lengua de señas y voz.

- **Entender:** la cámara sigue las manos y reconoce las señas que se le han enseñado; arma la frase y la lee en voz alta.
- **Responder:** se escribe o se dicta la respuesta y la app la muestra seña por seña con los videos guardados.
- **Diccionario incluido:** 55 señas básicas de la Lengua de Señas Colombiana, el abecedario y varios números en video (`senas/`), tomados de los conjuntos de datos LSC50 y LSC70, licencia CC BY 4.0. Créditos y cambios en `senas/CREDITOS.txt`. Sirven para responder; lo que no tiene seña se deletrea.
- **Mis señas:** cada seña nueva se enseña grabándola cinco veces; queda disponible para responder y para reconocerla.

Todo ocurre en el dispositivo: el video no se envía a ningún servidor.

El reconocimiento de manos usa MediaPipe Hand Landmarker (Apache 2.0), incluido en `lib/`. Tipografías Bricolage Grotesque y Figtree (SIL Open Font License) en `fonts/`.

## Reconocimiento por cámara

- `reco.js` convierte los puntos de las manos en un vector y lo compara con las señas enseñadas en “Mis señas”.
- `herramientas/evaluar.mjs` mide el reconocimiento con los datos de manos de LSC50. Con una persona que no está en el banco acierta cerca de 4 de cada 10 señas (6 de cada 10 con un clasificador más complejo), por eso la cámara no reconoce de fábrica las señas del diccionario: solo las que cada persona le enseña.
