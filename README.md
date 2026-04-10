# StarsTrek Web - Congreso de Fotografía Nocturna

Web del congreso StarsTrek Isla del Hierro, construida con Astro.

## 🚀 Tecnología

- **Astro** - Framework web moderno y rápido
- **Tailwind CSS** - Estilos utilitarios
- **Markdown** - Contenido editable

## 📁 Estructura de archivos

```
starstrek-web/
├── src/
│   ├── content/          ← CONTENIDO EDITABLE
│   │   ├── ponentes/     ← Datos de ponentes
│   │   ├── programa/     ← Horarios y agenda
│   │   └── talleres/     ← Información de talleres
│   ├── components/       ← Componentes visuales
│   ├── layouts/          ← Plantillas de página
│   ├── pages/            ← Rutas de la web
│   └── styles/           ← Estilos adicionales
├── public/               ← Archivos estáticos
│   └── images/           ← Imágenes
├── dist/                 ← Web generada (no editar)
└── package.json
```

## 📝 Cómo editar el contenido

### 1. Editar Ponentes

Abrir archivo: `src/content/ponentes/[nombre].md`

Ejemplo:
```markdown
---
nombre: "Daniel López"
rol: "Astrofotógrafo Canario"
fotoRetrato: "/images/retratos/daniel-lopez.jpg"
bio: "Texto de la biografía..."
instagram: "https://instagram.com/daniellopez"
orden: 1
galeria:
  - url: "/images/galerias/daniel-lopez/foto1.jpg"
    titulo: "Vía Láctea sobre Teide"
---

Texto extendido de la biografía...
```

**Campos:**
- `nombre`: Nombre del ponente
- `rol`: Cargo o especialidad
- `fotoRetrato`: Ruta a la foto de retrato
- `bio`: Biografía corta (2-3 líneas)
- `instagram`: URL de Instagram (opcional)
- `web`: URL de web personal (opcional)
- `orden`: Orden de aparición (1, 2, 3...)
- `galeria`: Lista de fotos de su trabajo

### 2. Editar Programa

Abrir archivo: `src/content/programa/[dia].md`

Ejemplo:
```markdown
---
dia: "Sábado"
fecha: "6 de Junio"
horarios:
  - hora: "10:00"
    tipo: "ponencia"
    titulo: "Título de la charla"
    ponente: "Nombre del ponente"
    descripcion: "Descripción de la actividad"
    destacado: true
---
```

**Tipos de actividad:**
- `apertura` - Apertura de puertas
- `inauguracion` - Acto inaugural
- `ponencia` - Charla/Conferencia
- `break` - Pausa/Coffee break
- `taller` - Taller práctico
- `actividad` - Otras actividades
- `clausura` - Clausura

### 3. Editar Talleres

Abrir archivo: `src/content/talleres/[nombre].md`

Ejemplo:
```markdown
---
titulo: "Nombre del taller"
instructor: "Nombre del instructor"
fecha: "Sábado 6 de junio"
hora: "20:00"
duracion: "2 horas"
aforo: "20 personas"
descripcion: "Descripción del taller..."
destacado: true
requisitos:
  - "Trípode"
  - "Cámara"
---
```

## 🖼️ Cómo añadir fotos

### Fotos de retratos de ponentes

1. Guardar la foto en: `public/images/retratos/`
2. Nombre del archivo: `[nombre-ponente].jpg` (o .png)
3. Actualizar en el archivo `.md` del ponente:
   ```yaml
   fotoRetrato: "/images/retratos/nombre-ponente.jpg"
   ```

### Fotos de galerías

1. Crear carpeta: `public/images/galerias/[nombre-ponente]/`
2. Guardar fotos allí
3. Actualizar en el archivo `.md`:
   ```yaml
   galeria:
     - url: "/images/galerias/nombre-ponente/foto1.jpg"
       titulo: "Título de la foto"
   ```

## 🚀 Cómo publicar cambios

Después de editar los archivos:

```bash
# 1. Ir a la carpeta del proyecto
cd ~/proyectos/starstrek-web

# 2. Generar la web
npm run build

# 3. La web generada está en la carpeta 'dist/'
# Subir todo el contenido de 'dist/' al servidor
```

## 🎨 Colores y estilos

Los colores principales están definidos en `tailwind.config.mjs`:

- `primary`: #0a0a0a (Negro espacial)
- `accent`: #3b82f6 (Azul eléctrico)
- `gold`: #fbbf24 (Dorado)
- `starlight`: #60a5fa (Azul claro)

Para cambiar colores, editar `tailwind.config.mjs` y regenerar.

## 📞 Soporte

Si necesitas ayuda:
- Revisar los archivos de ejemplo en `src/content/`
- Seguir la estructura exacta con los `---` al inicio
- Guardar siempre con codificación UTF-8

## 📄 Licencia

© 2026 StarsTrek - Todos los derechos reservados
