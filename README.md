# Puente de Señas

App web instalable para conversar entre lengua de señas y voz.

- **Entender:** la cámara sigue las manos y reconoce las señas que se le han enseñado; arma la frase y la lee en voz alta.
- **Responder:** se escribe o se dicta la respuesta y la app la muestra seña por seña con los videos guardados.
- **Diccionario incluido:** 55 señas básicas de la Lengua de Señas Colombiana, el abecedario y varios números en video (`senas/`), tomados de los conjuntos de datos LSC50 y LSC70, licencia CC BY 4.0. Créditos y cambios en `senas/CREDITOS.txt`. Sirven para responder; lo que no tiene seña se deletrea.
- **Mis señas:** cada seña nueva se enseña grabándola cinco veces; queda disponible para responder y para reconocerla.

Todo ocurre en el dispositivo: el video no se envía a ningún servidor.

El reconocimiento de manos usa MediaPipe Hand Landmarker (Apache 2.0), incluido en `lib/`. Tipografías Bricolage Grotesque y Figtree (SIL Open Font License) en `fonts/`.

## Reconocimiento por cámara

- `reco.js` convierte los puntos de las manos en un vector. Con él reconoce de dos maneras: comparando con las señas enseñadas en “Mis señas”, y con un modelo entrenado (`senas/modelo.json`).
- El modelo se entrenó con el banco LSC70 (70 personas): abecedario, números 1 y 4 a 10, mil, millón y diez palabras. Evaluado con personas que no vio al entrenar, acierta 83 de cada 100 señas; cuando solo responde si está seguro (lo que hace la app), acierta 91 de cada 100 y calla en 2 de cada 10.
- Para rehacerlo: extraer los puntos de las manos de las imágenes de LSC70, `node herramientas/rasgos70.mjs` para generar los vectores y entrenar una red de una capa oculta (160 neuronas). `herramientas/probar_modelo.mjs` comprueba el recorrido completo.
- `herramientas/evaluar.mjs` mide el reconocimiento con LSC50 (5 personas): no alcanza para reconocer esas 50 señas de fábrica, por eso no están en el modelo.
