# Bookish

Primera versión ejecutable de Bookish, un diario lector social.

## Requisitos

- Node.js 20 o posterior
- Conexión a internet para buscar títulos y portadas en Open Library

## Ejecutar

Desde esta carpeta:

```sh
npm start
```

Después abrí <http://localhost:4173>. El servidor crea `data/bookish.json` la primera vez. Ese archivo guarda cuentas, lecturas, perfiles, relaciones, likes, comentarios y listas. Está excluido de Git.

Las cuentas se comparten entre quienes usan la misma instancia del servidor. Para que amistades puedan entrar desde internet, Bookish necesita publicarse en un hosting con almacenamiento persistente. La sesión se mantiene mientras corre el servidor; al reiniciarlo, cada persona debe iniciar sesión otra vez.

## Incluye

- Registro, inicio y cierre de sesión; contraseñas con hash scrypt.
- Perfil público con nombre y bio editables.
- Buscar perfiles, seguir y dejar de seguir.
- Feed de lecturas, likes y comentarios.
- Diario con reseña, valoración de media a cinco estrellas, fechas, formato y procedencia.
- Estantería, libros sin leer y wishlist, con edición, estado físico y ubicación.
- Listas con nombre y descripción.
- Búsqueda de libros y portadas en Open Library.

Bookish es una primera versión: las lecturas, listas y perfiles son públicos para las cuentas de esta instancia; todavía no hay controles de privacidad por elemento ni edición/borrado de reseñas.
