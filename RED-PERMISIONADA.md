# Red privada permisionada — cadena de actas de la ECEME

Documento de operación y de pruebas. Describe cómo levantar la red de tres
nodos, cómo funciona el consenso y cómo reproducir las cinco pruebas de
verificación ante el tribunal.

---

## 1. Qué es esta red

La cadena de actas dejó de vivir en un solo proceso. Ahora la sostienen
**tres nodos independientes**, cada uno con su **identidad criptográfica** y su
**propia copia** de la cadena.

| Nodo | Nombre | Puerto | Rol | Base de datos |
|---|---|---|---|---|
| `nodo-1` | VALIDADOR-PRINCIPAL | 3001 | proponente | `eceme_db` |
| `nodo-2` | AUDITOR-A | 3002 | auditor | `eceme_nodo_2` |
| `nodo-3` | AUDITOR-B | 3003 | auditor | `eceme_nodo_3` |

- El **nodo 1** es el servidor académico de siempre: expone toda la API
  (login, notas, reportes) **y además** propone los bloques. Es el único que
  puede proponer.
- Los **auditores** no saben nada de alumnos, notas ni usuarios: solo guardan
  su copia de la cadena, validan lo que se les propone y firman. Un mismo
  código (`apps/nodo/index.js`) levanta el nodo 2 o el 3 según el argumento
  que reciba.
- Las copias están **en esquemas MySQL separados**. Esa separación es lo que
  hace que la replicación sea real y demostrable: si alguien altera la copia
  del nodo 1, las de los auditores siguen sanas y la diferencia se detecta.

No es Ethereum ni Hyperledger. No hay minería, ni criptomonedas, ni contratos
inteligentes. Es una cadena propia sobre Node.js, con el módulo `crypto`
nativo: **SHA-256** para el hash y **Ed25519** para las firmas.

---

## 2. Identidad y permisos

Cada nodo tiene un par de claves **Ed25519**:

- La **clave privada** vive en `claves/<nodeId>.priv.pem`, fuera del control de
  versiones (`claves/` está en `.gitignore`). Nunca sale del nodo.
- La **clave pública** se declara en `red-permisionada.json`, que es el
  **registro de permisos** de la red. Un nodo cuya clave pública no figure ahí
  queda excluido: sus firmas no cuentan para el quórum.

Ese archivo también fija el **quórum: 2 de 3**.

---

## 3. Cómo funciona el consenso

Consenso por **quórum de firmas** (Proof of Authority). Cuando el administrador
publica un acta:

1. El nodo 1 arma el bloque candidato (índice, materia, ciclo, acta,
   `hash_previo`) y calcula su hash con la fórmula de siempre.
2. Lo **propone** a los auditores por HTTP, en paralelo, con un timeout corto
   (2,5 s) para que un nodo caído no cuelgue la interfaz.
3. Cada auditor valida **por su cuenta, sin confiar en el proponente**:
   - recalcula el hash desde el contenido recibido y lo compara;
   - comprueba que el bloque encaje en **su propia** copia: índice consecutivo
     y `hash_previo` igual al hash de su último bloque;
   - aplica las reglas de negocio: el acta debe traer al menos un registro y
     toda nota debe estar entre 0 y 100.

   Si todo pasa, firma el hash con su clave privada. Si algo falla, rechaza
   indicando el motivo.
4. El nodo 1 firma también. Si reúne **al menos 2 firmas válidas** de claves
   registradas, confirma el bloque: lo guarda con sus firmas y lo replica a
   los auditores, que **vuelven a verificar** hash, encadenado y firmas antes
   de guardarlo.
5. Si **no** alcanza el quórum, el bloque se descarta: no se guarda nada y
   **las notas no quedan publicadas**. El administrador recibe un error claro.

**Punto importante para el capítulo:** las firmas se calculan **sobre el hash
del bloque** y se guardan en una columna aparte (`bloques.firmas`).
**No entran en el cálculo del hash.** Por eso la fórmula de `calcularHash()` no
se tocó y toda la cadena anterior sigue verificando igual.

### Bloques heredados

Los bloques sellados antes de que existiera la red no tienen firmas. Se llaman
**heredados**: se validan por hash y encadenado, y la interfaz los marca como
tales. Los bloques nuevos sí exigen quórum.

---

## 4. Puesta en marcha (una sola vez)

Desde la **raíz** del repositorio, en PowerShell:

```powershell
npm install                # instala desde la raíz (workspaces). NUNCA dentro de apps/server
npm run red:claves         # genera las claves Ed25519 y escribe red-permisionada.json
npm run red:bd             # crea eceme_nodo_2 y eceme_nodo_3 con su tabla bloques
```

Y la migración de la base principal, que agrega la columna de firmas:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p eceme_db `
  --default-character-set=utf8mb4 -e "source apps/server/red-firmas.sql"
```

Los dos scripts de npm son **idempotentes**: si las claves ya existen se
conservan (no se invalidan las firmas ya emitidas) y las bases no se borran.

## 5. Arranque diario

```powershell
npm run red             # los tres nodos
npm run red:completa    # los tres nodos + el frontend React
```

Por separado, cada uno en su terminal:

```powershell
npm run dev --prefix apps/server    # nodo 1 (3001)
npm run nodo:2                      # nodo 2 (3002)
npm run nodo:3                      # nodo 3 (3003)
```

**Páginas de demostración:**

- `http://localhost:3001/red.html` — panel de la red: semáforo por nodo,
  altura de cada copia, firmas de cada bloque y botón de verificación cruzada.
  Se refresca solo cada 3 s, así que un nodo que se cae se ve al momento.
- `http://localhost:3001/blockchain.html` — la cadena bloque a bloque.

**Endpoints de observabilidad:**

| Endpoint | Para qué |
|---|---|
| `GET /api/red/estado` | Quién está vivo, altura de cada copia, quórum, si las copias coinciden |
| `GET /api/red/verificacion-cruzada` | Compara las tres copias e informa en qué índice divergen |
| `GET /api/red/config` | Registro de permisos: nodos, roles y claves públicas |
| `POST /api/red/sincronizar` | Pide a los auditores que se pongan al día ahora (admin) |
| `GET /api/blockchain/verificar` | Integridad de la copia local + firmas de cada bloque |
| `GET /nodo/info` `/nodo/huellas` `/nodo/cadena` `/nodo/verificar` | Lo mismo, en cada auditor |

Cada propuesta, cada firma recibida y cada confirmación se registran en la
consola con el `nodeId` y el índice del bloque. Esos logs son la evidencia
para el documento.

---

## 6. Las cinco pruebas de verificación

> Antes de empezar, dejá abierta `http://localhost:3001/red.html`.
> Para apagar un nodo alcanza con cerrar su terminal (`Ctrl+C`) o:
> ```powershell
> Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
>   Where-Object { $_.CommandLine -like '*nodo-3*' } |
>   ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
> ```

### Prueba 1 — Sellado con la red completa

Con los tres nodos arriba, publicá un acta desde el panel del administrador
(o `POST /api/actas/publicar` con `{"materia_id": N}`).

**Qué debe pasar:** el bloque se confirma con **3 firmas** y las tres copias
quedan a la misma altura.

```
firmas: nodo-1 (VALIDADOR-PRINCIPAL) · nodo-2 (AUDITOR-A) · nodo-3 (AUDITOR-B)
replicacion: nodo-2 guardado ✔ · nodo-3 guardado ✔
copias coinciden: true → alturas 7 / 7 / 7
```

### Prueba 2 — Tolerancia a fallos: un nodo caído

Apagá el **nodo 3** y publicá otra acta.

**Qué debe pasar:** el bloque se confirma igual, con **2 firmas** (quórum
alcanzado). En `red.html` el nodo 3 aparece en rojo. La cadena sigue
verificando.

```
firmas: nodo-1 · nodo-2
replicacion: nodo-2 guardado ✔ · nodo-3 NODO_CAIDO
/api/blockchain/verificar → valida: true
```

### Prueba 3 — Sin quórum no se publica

Apagá **también el nodo 2** e intentá publicar.

**Qué debe pasar:** la publicación se **rechaza con HTTP 409** y —esto es lo
importante— **las notas NO quedan publicadas** y **no se crea ningún bloque**.

```
HTTP 409
{"motivo":"SIN_QUORUM","firmas_validas":1,"quorum":2,"firmantes":["nodo-1"]}
```

Para que la prueba sea contundente, elegí una materia con notas sin publicar y
comprobá antes y después:

```sql
SELECT COUNT(*) AS total, SUM(publicado=1) AS publicadas FROM notas WHERE materia_id = 9;
SELECT COUNT(*) AS bloques FROM bloques;
```

Ambas cifras deben quedar **idénticas** antes y después del intento.

### Prueba 4 — Reincorporación y sincronización

Volvé a levantar los nodos caídos (`npm run nodo:2`, `npm run nodo:3`).

**Qué debe pasar:** cada nodo detecta que está atrasado y **pide los bloques
que le faltan**, verificando hash, encadenado y firmas de cada uno antes de
aceptarlo. Sin intervención manual.

```
[nodo-3/AUDITOR-B] sincronizacion: bloque #7 aceptado (2 firmas)
[nodo-3/AUDITOR-B] sincronizado al arrancar: 1 bloque(s) incorporado(s)
copias coinciden: true
```

Si un nodo estuvo caído mucho tiempo, también se sincroniza solo al recibir la
siguiente propuesta, o a pedido con `POST /api/red/sincronizar`.

### Prueba 5 — Detección de una copia alterada

Alterá a mano la copia del **nodo 1** en MySQL Workbench:

```sql
SET SQL_SAFE_UPDATES = 0;   -- o usá LIMIT 1, ver más abajo

UPDATE bloques
SET acta_json = JSON_REPLACE(acta_json, '$.registros[0].parcial_final', '95.00')
WHERE indice = 6
LIMIT 1;
```

Pulsá **«Verificación cruzada»** en `red.html`.

**Qué debe pasar:** se señala el bloque alterado y contra qué copias diverge,
mientras las copias de los auditores siguen íntegras.

```
todas_coinciden: false
alterados_en_referencia: [6]
divergencias: [{nodo-2, indice 6}, {nodo-3, indice 6}]
auditores → /nodo/verificar: {"valida": true}
```

> **Por qué se detecta.** La comparación no usa el hash *guardado* sino el
> hash **recalculado desde el contenido** de cada copia. Si sólo se comparara
> el guardado, un atacante que edite el acta sin tocar la columna `hash`
> pasaría inadvertido en la comparación entre nodos.

**Para restaurar**, la copia buena la tienen los auditores:

```powershell
# Recupera el acta original del nodo 2 y la vuelve a poner en el nodo 1
node -e "fetch('http://localhost:3002/nodo/cadena').then(r=>r.json()).then(c=>{const b=c.find(x=>x.indice===6);const m=require('mysql2');require('dotenv').config({path:'apps/server/.env'});const q=m.createConnection({host:'localhost',user:'root',password:process.env.DB_PASSWORD,database:'eceme_db'});q.query('UPDATE bloques SET acta_json=? WHERE indice=6',[JSON.stringify(b.acta)],()=>{console.log('restaurado');q.end()})})"
```

Ese paso es, de paso, la mejor demostración de para qué sirve la replicación:
**la red repara la copia dañada**.

---

## 7. Nota sobre MySQL Workbench

Workbench rechaza los `UPDATE` cuyo `WHERE` no usa una clave primaria
(error 1175). En la tabla `bloques` la clave es `id`, no `indice`, así que
agregá `LIMIT 1` a las sentencias de la prueba 5 (MySQL las acepta con
`LIMIT`) o desactivá el modo seguro en
*Edit → Preferences → SQL Editor → Safe Updates* y reconectá.

---

## 8. Qué quedó fuera de alcance

Conviene declararlo en el documento antes de que lo pregunte el tribunal:

- **Un solo proponente.** El nodo 1 es el único que propone bloques. No hay
  elección de líder ni rotación: si el nodo 1 cae, la red no sella (sí sigue
  sirviendo para auditar las copias). Es coherente con el caso: la ECEME es la
  autoridad que emite las actas.
- **Sin tolerancia bizantina.** El quórum protege contra nodos caídos y contra
  bloques inválidos, no contra un proponente y un auditor coaligados para
  firmar un acta falsa. Con 2 de 3, dos nodos comprometidos bastarían. Un
  esquema BFT tipo PBFT necesitaría 3f+1 nodos.
- **Los tres nodos corren en la misma máquina**, en puertos distintos. La
  separación es de procesos y de bases de datos, no de hardware. En producción
  cada auditor debería estar en un equipo distinto, idealmente bajo otra
  dependencia.
- **Transporte HTTP sin TLS ni autenticación mutua** entre nodos. En una red
  real habría que exigir certificados de cliente o firmar también las
  peticiones. Aquí la confianza se apoya en que la red es local.
- **Los bloques heredados no tienen firmas** (son anteriores a la red). Se
  aceptan verificando hash y encadenado.
- **La replicación no bloquea la confirmación.** Si un auditor no responde al
  replicar, el bloque igual se confirma y ese nodo se pone al día después. Es
  una decisión deliberada: prioriza que la publicación no se cuelgue.
