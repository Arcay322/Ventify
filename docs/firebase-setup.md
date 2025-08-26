# Configuración de Firebase para Ventify

Este documento explica cómo obtener la configuración correcta de Firebase y solucionar errores comunes como 400 al conectar.

## 1) Obtener credenciales en Firebase Console
1. Ve a https://console.firebase.google.com/
2. Selecciona tu proyecto (o crea uno nuevo).
3. En la rueda de configuración (⚙️) -> Configuración del proyecto -> 'Tus apps', añade una app web si no existe.
4. Copia el bloque de configuración que incluye apiKey, authDomain, projectId, storageBucket, messagingSenderId y appId.

## 2) Rellenar `.env.local`
Copia `.env.example` a `.env.local` y pega los valores:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

> Usa `NEXT_PUBLIC_` cuando las variables deban ser accesibles desde el cliente (p. ej. apiKey). Evita comitear `.env.local`.

## 3) Errores 400 comunes y cómo depurarlos
- Error 400 en llamadas a Firestore suele indicar una configuración inválida (projectId incorrecto) o reglas de seguridad que bloquean la petición.
- Revisa la consola del navegador (Network tab) para ver la petición que falla y su payload.
- Asegúrate de que `projectId` coincide exactamente con el ID del proyecto en Firebase console.
- Comprueba las reglas de Firestore: si están restrictivas (por ejemplo, `allow read, write: if false;`), ajusta temporalmente para pruebas:

```
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

(Recuerda revertir reglas abiertas en producción.)

## 4) Probar la conexión
- Reinicia el servidor de desarrollo tras actualizar `.env.local`.
- Abre el panel de Network en DevTools y mira las llamadas a `firestore.googleapis.com` o `firebaseinstallations.googleapis.com`.
- Si ves `400 Bad Request`, copia la respuesta JSON y revisa el `error.message`.

## 5) Logs y pasos extra
- Ejecuta `npm run dev` y observa la consola donde aparecerán warnings o errores al inicializar Firebase.
- Si aparece el error que lanzamos: `Firebase no está configurado correctamente. Faltan variables: ...`, completa las variables faltantes.

Si quieres, puedo:
- Verificar tu `.env.local` (NO compartas valores públicos aquí — indícame si prefieres que lo revise localmente ejecutando comandos).
- Inspeccionar la traza exacta del error 400 si pegas la respuesta JSON (sin exponer claves privadas).

