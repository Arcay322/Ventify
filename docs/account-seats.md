# Control de asientos por plan (crear usuarios desde admin)

Resumen
---
Se añadió una Cloud Function HTTP `createUserForAccount` expuesta en `functions/api/createUserForAccount` (ruta: `/api/createUserForAccount` cuando despliegues `exports.api`). Esta función permite a un admin crear usuarios para una cuenta respetando los límites `limits` definidos en `accounts/{accountId}`.

Flujo esperado
---
1. Un admin (propietario o con custom claim `admin:true`) obtiene su ID token (desde la app cliente tras iniciar sesión).
2. Llama al endpoint HTTP `/createUserForAccount` con `Authorization: Bearer <ID_TOKEN>` y `body: { accountId, email, password, role }`.
3. La función valida permisos, ejecuta una transacción para reservar asiento y crea el usuario en Auth + documento `users/{uid}`. Devuelve `uid`.

Despliegue (básico)
---
1. En `functions/` instala dependencias:

```powershell
cd functions
npm install
```

2. Instala Firebase CLI y despliega (si no lo tienes):

```powershell
npm install -g firebase-tools
firebase deploy --only functions
```

Llamada de ejemplo (curl)
---
Suponiendo que el API quedó en `https://us-central1-<project>.cloudfunctions.net/api/createUserForAccount`:

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"account-123","email":"nuevo@ejemplo.com","password":"Secret123!","role":"worker"}' \
  https://us-central1-<project>.cloudfunctions.net/api/createUserForAccount
```

Notas
---
- Asegúrate de tener la colección `accounts/{accountId}` con campos `limits` y `counts`. Ejemplo de documento:

```json
{
  "ownerUid": "<uid>",
  "limits": { "admins": 2, "workers": 5 },
  "counts": { "admins": 1, "workers": 0 }
}
```

- Si la función falla después de reservar el asiento pero antes de crear el usuario, la función actualmente intenta reportar el error; se puede extender para decrementar counts en rollback si fuese necesario.
