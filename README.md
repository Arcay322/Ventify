# Firebase Studio

Aplicación Next.js para Punto de Venta (PDV) e inventario, con landing comercial.

Principales puntos:
 - Next.js v15 (Turbopack)
 - Firebase (Firestore) para datos en tiempo real
 - TailwindCSS y Radix UI para la interfaz
 - Genkit (opcional) para funciones IA

Inicio rápido
1. Copia `.env.example` a `.env.local` y completa las variables necesarias.
2. Instala dependencias y arranca el dev server:

```powershell
Set-Location -Path 'u:\Ventify'
npm install
copy .env.example .env.local # Powershell copy
npm run dev
```

Variables de entorno
Rellena `.env.local` con las variables listadas en `.env.example`. Las claves sensibles no deben comitearse.

Seguridad: claves en el repositorio
---------------------------------
Si accidentalmente comiteaste una API key o credenciales (por ejemplo, en `src/lib/firebase.ts`), hay dos acciones recomendadas:

1) Rotar/regenerar la clave en el proveedor (más seguro y rápido).
2) Limpiar el historial Git local/remote para eliminar referencias (operación destructiva).

Limpiar historial - guía resumida (haz backup antes)
-------------------------------------------------
Usa esta guía solo si estás cómodo reescribiendo el historial y entiendes que afectará a todos los colaboradores.

1. Clona el repositorio como espejo (mirror):

```powershell
git clone --mirror https://github.com/Arcay322/Ventify.git
```

2. Usa BFG Repo-Cleaner o git filter-repo para eliminar las referencias a archivos o cadenas:

Con BFG (más simple):

```powershell
# instalar BFG (si no está instalado)
# choco install bfg
# eliminar un archivo de todos los commits
bfg --delete-files 'src/lib/firebase.ts' Ventify.git

# o para eliminar una cadena (ej. la API key):
bfg --replace-text replacements.txt Ventify.git
```

Con git filter-repo (recomendado):

```powershell
# instalar git-filter-repo y usarlo para reemplazar/filtrar historiales
# git-filter-repo no viene con git por defecto en Windows; consulta la documentación
git -C Ventify.git filter-repo --invert-paths --paths src/lib/firebase.ts
```

3. Limpia y empuja forzadamente:

```powershell
cd Ventify.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

Advertencia: Forzar push reescribirá la historia remota; coordina con colaboradores. Alternativa menos destructiva: crear un nuevo repositorio y transferir el código limpio.

Contacto
Si quieres, puedo:
 - Mover ahora la configuración a variables de entorno (ya hecho).
 - Crear `.env.local` de ejemplo (ya incluido).
 - Ejecutar los pasos para reescribir el historial aquí (te pediré confirmación explícita antes de cualquier cambio destructivo).
