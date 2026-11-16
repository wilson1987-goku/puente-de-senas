# InclusivApp

App web instalable para conversar entre lengua de señas y voz.

- **Entender:** la cámara sigue las manos y reconoce las señas que se le han enseñado; arma la frase y la lee en voz alta.
- **Responder:** se escribe o se dicta la respuesta y la app la muestra seña por seña con los videos guardados.
- **Diccionario incluido:** 55 señas básicas de la Lengua de Señas Colombiana, el abecedario y varios números en video (`senas/`), tomados de los conjuntos de datos LSC50 y LSC70, licencia CC BY 4.0. Créditos y cambios en `senas/CREDITOS.txt`. Sirven para responder; lo que no tiene seña se deletrea.
- **Mis señas:** cada seña nueva se enseña grabándola cinco veces; queda disponible para responder y para reconocerla.

Todo ocurre en el dispositivo: el video no se envía a ningún servidor.

El reconocimiento de manos usa MediaPipe Hand Landmarker (Apache 2.0), incluido en `lib/`. Tipografías Sora y Manrope (SIL Open Font License) en `fonts/`.

## Reconocimiento por cámara

- `reco.js` convierte los puntos de las manos en un vector. Con él reconoce de dos maneras: comparando con las señas enseñadas en la app, y con un modelo entrenado (`senas/modelo.json`).
- El modelo se entrenó con el banco LSC70 (70 personas): abecedario, números 1 y 4 a 10, mil, millón y diez palabras. Además aprende una clase "nada" con tramos de LSC50 (reposo, transiciones y otras señas) para callar cuando no hay una seña suya.
- Medido con personas que no vio al entrenar: acierta 84 de cada 100 señas. Con la exigencia que usa la app (confianza de 0,9), por cada lectura suelta dice bien 72, dice mal 4 y calla 24; cuando no hay seña, inventa una en 6 de cada 100. La app además exige cuatro lecturas seguidas iguales y descarta lo que queda lejos de los ejemplos conocidos.
- Para rehacerlo: extraer los puntos de las manos de las imágenes de LSC70, `node herramientas/rasgos.mjs` para generar los vectores y `python3 herramientas/entrenar.py` para medir o entrenar. `herramientas/probar_modelo.mjs` comprueba el recorrido completo.
- `herramientas/evaluar.mjs` mide el reconocimiento por comparación con LSC50 (5 personas): no alcanza para leer esas 50 señas de fábrica.

## Diseño

Una sola pantalla tipo conversación: arriba la cámara (o el video de la respuesta en señas), en medio los mensajes y abajo el teclado. Enseñar señas, el diccionario, los ajustes y la ayuda están en una hoja que sube desde abajo.

## Nombre e icono

La app se llama InclusivApp (antes Puente de Señas; el repositorio y la dirección conservan el nombre anterior). Su icono y sus colores se inspiran en la bandera sorda, diseñada por Arnaud Balard y adoptada por la Federación Mundial de Sordos (WFD) en 2023. El dibujo del icono es propio; el diseño oficial de la bandera está registrado y sus derechos pertenecen a la WFD.
