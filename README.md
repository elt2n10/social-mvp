# MVP социальной сети

Проект состоит из двух частей:

- `server` — Node.js + Express + SQLite
- `client` — React + Vite

## Быстрый запуск

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

В другом терминале:

```bash
cd client
npm install
npm run dev
```

Открой:

```text
http://localhost:5173/?invite=secret123
```

## Данные из .env

Файл `server/.env` не должен попадать в GitHub.

```env
PORT=4000
CLIENT_URL=http://localhost:5173
JWT_SECRET=super_secret_key_change_me
DEV_PASSWORD=паролянетитдговно
INVITE_CODE=secret123
DATABASE_FILE=./database.sqlite
```

## Режим разработчика

1. Войди в аккаунт.
2. Нажми `Ctrl + Shift + D`.
3. Введи пароль из `DEV_PASSWORD`.
4. Откроется dev-панель.

## Что есть в MVP

- регистрация и вход;
- bcrypt-хэширование паролей;
- JWT авторизация;
- invite-доступ через backend;
- посты с картинками;
- лайки и комментарии;
- личные сообщения;
- короткие видео;
- профиль и редактирование;
- настройки;
- скрытая dev-панель;
- блокировка пользователей;
- загрузка файлов через multer;
- тёмный адаптивный интерфейс.
