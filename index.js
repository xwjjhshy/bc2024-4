const http = require('http');
const fs = require('fs');
const path = require('path');
const superagent = require('superagent');
const { program } = require('commander');

program
  .requiredOption('-h --host <host>', 'server host')
  .requiredOption('-p --port <port>', 'server port')
  .requiredOption('-c --cache <path>', 'cache dir');

program.parse(process.argv);

const { host, port, cache } = program.opts();

// Переконайтеся, що директорія кешу існує
if (!fs.existsSync(cache)) {
  fs.mkdirSync(cache);
}

// Функція обробки запиту
const requestHandler = (req, res) => {
  const code = req.url.slice(1);
  console.log(`Request: ${req.url}`);
  const imagePath = path.join(cache, `${code}.jpg`);
  console.log(`Getting image: ${code}`);
  
  // Перевірка методу HTTP-запиту
  switch (req.method) {
    case 'GET':
      // Перевірка, чи існує файл у кеші
      fs.access(imagePath, fs.constants.F_OK, (err) => {
        if (err) {
          // Якщо файл не існує, робимо запит до http.cat
          superagent.get(`https://http.cat/${code}`)
            .then(response => {
              // Якщо запит успішний, зберігаємо картинку у кеш
              fs.writeFile(imagePath, response.body, (err) => {
                if (err) {
                  res.writeHead(500, { 'Content-Type': 'text/plain' });
                  res.end('Internal Server Error');
                } else {
                  res.writeHead(200, { 'Content-Type': 'image/jpeg' });
                  res.end(response.body);
                }
              });
            })
            .catch(err => {
              // Якщо запит завершився помилкою, повертаємо 404
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not Found');
            });
        } else {
          // Якщо файл існує, відправляємо його
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          fs.createReadStream(imagePath).pipe(res);
        }
      });
      break;

    case 'PUT':
      // Створення та запис файлу
      const writeStream = fs.createWriteStream(imagePath);
      req.pipe(writeStream);

      req.on('end', () => {
        res.writeHead(201, { 'Content-Type': 'text/plain' });
        res.end('Created');
      });

      req.on('error', () => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      });
      break;

    case 'DELETE':
      // Видалення файлу
      fs.access(imagePath, fs.constants.F_OK, (err) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } else {
          fs.unlink(imagePath, (err) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Internal Server Error');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('OK');
            }
          });
        }
      });
      break;

    default:
      // Відповідь для невірного методу
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      break;
  }
};

// Створення сервера
const server = http.createServer(requestHandler);

server.listen(port, host, () => {
  console.log(`Сервер запущено на http://${host}:${port}`);
});
