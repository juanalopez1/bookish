#!/usr/bin/env node pus
// Sube el número de versión en un solo paso, para que las personas reciban el botón "Actualizar".
// Uso:  node subir-version.js        (suma 1)
//       node subir-version.js 20     (pone la 20)
const fs = require("fs");
const read = (f) => fs.readFileSync(f, "utf8");
const sw = read("public/sw.js");
const actual = Number((sw.match(/const VERSION = "(\d+)"/) || [])[1]);
if (!actual) {
  console.error("No encontré VERSION en public/sw.js");
  process.exit(1);
}
const next = Number(process.argv[2]) || actual + 1;
const swap = (file, re, to) => {
  const t = read(file);
  if (!re.test(t)) {
    console.error(`No encontré lo que había que cambiar en ${file}`);
    process.exit(1);
  }
  fs.writeFileSync(file, t.replace(re, to));
};
swap("public/sw.js", /const VERSION = "\d+"/, `const VERSION = "${next}"`);
swap(
  "public/app.js",
  /const APP_VERSION = "\d+"/,
  `const APP_VERSION = "${next}"`,
);
swap("public/index.html", /style\.css\?v=\d+/, `style.css?v=${next}`);
swap("public/index.html", /app\.js\?v=\d+/, `app.js?v=${next}`);
console.log(
  `Versión ${actual} → ${next}. Reiniciá el servidor y la gente verá el aviso "Actualizar".`,
);
