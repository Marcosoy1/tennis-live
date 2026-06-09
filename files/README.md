# Tennis Live — Backend + PWA

## Estructura del proyecto

```
tennis-backend/
├── api/
│   ├── matches.js      ← Endpoint principal de partidos
│   └── refresh.js      ← Cron job diario (6:00 UTC)
├── public/
│   ├── index.html      ← La PWA
│   ├── manifest.json   ← Config PWA
│   └── sw.js           ← Service Worker
├── package.json
├── vercel.json         ← Config Vercel + cron
└── README.md
```

---

## Pasos para desplegar

### 1. Sube a GitHub
- Crea un repositorio nuevo en github.com (llámalo "tennis-live")
- Sube todos estos ficheros manteniendo la estructura de carpetas

### 2. Consigue tu API Key de RapidAPI
- Ve a https://rapidapi.com
- Busca "API-Tennis" y suscríbete al plan gratuito
- Copia tu `x-rapidapi-key`

### 3. Despliega en Vercel
- Ve a https://vercel.com y conecta tu cuenta de GitHub
- Click en "Add New Project" → selecciona el repo "tennis-live"
- En "Environment Variables" añade:
  - `RAPIDAPI_KEY` = tu clave de RapidAPI
- Click "Deploy" — en 1 minuto tendrás una URL tipo `tennis-live.vercel.app`

### 4. Configura la PWA
- Abre `public/index.html`
- Cambia esta línea:
  ```js
  const BACKEND_URL = "https://TU-PROYECTO.vercel.app";
  ```
  por tu URL real de Vercel, por ejemplo:
  ```js
  const BACKEND_URL = "https://tennis-live.vercel.app";
  ```
- Guarda y haz push a GitHub — Vercel redesplegará automáticamente

### 5. Instala la PWA en tu móvil
- Abre `https://tennis-live.vercel.app/public/index.html` en Chrome Android
- Menú (⋮) → "Añadir a pantalla de inicio"
- ¡Listo! Aparecerá como app con icono

---

## Cómo funciona la actualización diaria

Vercel ejecuta automáticamente `/api/refresh` cada día a las **6:00 UTC (8:00 hora España)**.
Ese endpoint llama a RapidAPI y guarda los partidos del día en memoria.
Cuando abres la app, `/api/matches` devuelve los datos frescos.

---

## Notas

- El plan gratuito de RapidAPI-Tennis da ~500 llamadas/mes, más que suficiente
- Si un día falla la API, la app muestra los datos del día anterior
- Los análisis de IA se generan en tiempo real al abrir cada partido
