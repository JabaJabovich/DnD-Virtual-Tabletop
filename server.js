require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
const rateLimit = require('express-rate-limit');

// Общий лимит
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 200,
  message: { error: 'Слишком много запросов, попробуйте позже' },
});

// Строгий лимит для загрузки файлов
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 20,
  message: { error: 'Слишком много загрузок' },
});

// Лимит для импорта монстров
const monsterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Слишком много запросов к API монстров' },
});

app.use(generalLimiter);
app.use('/upload', uploadLimiter);
app.use('/api/import-monster', monsterLimiter);

app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Папки для загрузок
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
['maps', 'tokens', 'avatars'].forEach(f => {
  const d = path.join(UPLOADS_DIR, f);
  if (!fs.existsSync(d)) fs.mkdirSync(d);
});
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// Эндпоинт загрузки изображений
const ALLOWED_FOLDERS = ['maps', 'tokens', 'avatars'];
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB в base64

app.post('/upload', (req, res) => {
  const { imageBase64, folder } = req.body;

  // Валидация папки
  if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
    return res.status(400).json({ error: 'Недопустимая папка' });
  }

  // Валидация наличия данных
  if (!imageBase64) {
    return res.status(400).json({ error: 'Нет данных изображения' });
  }

  // Валидация типа файла
  const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
  if (!mimeMatch) {
    return res.status(400).json({ error: 'Недопустимый формат файла' });
  }

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimes.includes(mimeMatch[1])) {
    return res.status(400).json({ error: 'Недопустимый тип файла' });
  }

  // Проверка размера
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const sizeInBytes = Buffer.byteLength(base64Data, 'base64');
  if (sizeInBytes > MAX_UPLOAD_SIZE) {
    return res.status(400).json({ error: 'Файл слишком большой (макс. 10MB)' });
  }

  // Безопасное имя файла
  const ext = mimeMatch[1].split('/')[1];
  const fileName = `${Date.now()}-${Math.floor(Math.random() * 100000)}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, folder, fileName);

  fs.writeFile(filePath, base64Data, 'base64', (err) => {
    if (err) {
      console.error('Ошибка записи файла:', err);
      return res.status(500).json({ error: 'Ошибка сохранения файла' });
    }
    res.json({ url: `/uploads/${folder}/${fileName}` });
  });
});


// Импорт монстров из D&D API
app.get('/api/import-monster/:name', async (req, res) => {
  const monsterName = req.params.name.toLowerCase().replace(/\s+/g, '-');
  try {
    const response = await axios.get(`https://www.dnd5eapi.co/api/monsters/${monsterName}`);
    const data = response.data;
    const imported = {
      id: generateId(),
      name: data.name,
      hp: data.hit_points,
      maxHp: data.hit_points,
      ac: data.armor_class[0].value || 10,
      type: 'monster',
      vision: 60,
      stats: {
        str: Math.floor(((data.strength || 10) - 10) / 2),
        dex: Math.floor(((data.dexterity || 10) - 10) / 2),
        con: Math.floor(((data.constitution || 10) - 10) / 2),
        int: Math.floor(((data.intelligence || 10) - 10) / 2),
        wis: Math.floor(((data.wisdom || 10) - 10) / 2),
        cha: Math.floor(((data.charisma || 10) - 10) / 2)
      },
      attacks: data.actions ? data.actions.filter(a => a.attack_bonus).map(action => ({
        id: generateId(),
        name: action.name,
        attackBonus: action.attack_bonus || 0,
        damageDice: action.damage ? action.damage[0]?.damage_dice : '1d6',
        damageBonus: action.damage ? action.damage[0]?.damage_bonus : 0
      })) : [],
      abilities: data.special_abilities ? data.special_abilities.map(a => `**${a.name}:**\n${a.desc}`).join('\n\n') : '',
      inventory: ''
    };
    res.json(imported);
  } catch (err) {
    res.status(404).send('Монстр не найден');
  }
});

// Подключение к PostgreSQL и создание таблиц (ИСПРАВЛЕНО)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.connect()
  .then(async (client) => {
    console.log('✅ PostgreSQL подключен успешно!');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS accounts (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'player',
          characters JSONB
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255),
          state JSONB
        );
        CREATE TABLE IF NOT EXISTS scenes (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255),
          map_config JSONB
        );
      `);
      console.log('✅ Таблицы базы данных успешно проверены/созданы!');
    } catch (err) {
      console.error('❌ Ошибка при создании таблиц:', err.message);
    } finally {
      client.release();
    }
  })
  .catch(err => console.error('❌ Ошибка БД:', err.stack));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8,
  pingTimeout: 30000,
  pingInterval: 10000,
  // Отключает сжатие (быстрее для мелких пакетов движения)
  perMessageDeflate: false, 
  allowEIO3: true
});

// Кэш активных сессий и отложенное сохранение в БД
let activeSessions = {};
let dirtySessions = new Set(); // только изменённые сессии
let saveTimeout = null;
let isSaving = false;


function scheduleDbSave(sessionId) {
  if (sessionId) dirtySessions.add(sessionId);
  if (saveTimeout) return;
  saveTimeout = setTimeout(async () => {
    if (isSaving) {
      saveTimeout = null;
      scheduleDbSave();
      return;
    }
    isSaving = true;
    const toSave = [...dirtySessions];
    dirtySessions.clear();
    try {
      for (const id of toSave) {
        if (activeSessions[id]) {
          await pool.query(
            'UPDATE sessions SET state = $1 WHERE id = $2',
            [activeSessions[id], id]
          );
        }
      }
    } catch (err) {
      console.error('Ошибка записи в БД:', err);
      // Возвращаем несохранённые сессии обратно
      toSave.forEach(id => dirtySessions.add(id));
    }
    isSaving = false;
    saveTimeout = null;
  }, 2000);
}


// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  try {
    for (const [id, state] of Object.entries(activeSessions)) {
      await pool.query('UPDATE sessions SET state = $1 WHERE id = $2', [state, id]);
    }
  } catch (err) {
    console.error('Error saving sessions on exit:', err);
  }
  await pool.end();
  io.close();
  server.close(() => process.exit(0));
});

const bcrypt = require('bcrypt');

// Эндпоинт логина — проверяем пароль на сервере
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, role, characters, password FROM accounts WHERE username = $1',
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const account = result.rows[0];
    let isValid = false;

// Если пароль уже хэширован bcrypt
if (account.password && account.password.startsWith('$2b$')) {
  isValid = await bcrypt.compare(password, account.password);
} else {
  // Старый пароль в открытом виде — сравниваем напрямую
  isValid = account.password === password;

  // И сразу обновляем на хэш
  if (isValid) {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE accounts SET password = $1 WHERE id = $2',
      [hashed, account.id]
    );
  }
}

if (!isValid) {
  return res.status(401).json({ error: 'Неверный логин или пароль' });
}

    // Возвращаем аккаунт БЕЗ пароля
    const { password: _, ...safeAccount } = account;
    res.json(safeAccount);
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Эндпоинт регистрации
app.post('/api/register', async (req, res) => {
  const { id, username, password, role, characters } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM accounts WHERE username = $1',
      [username.trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Пользователь уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO accounts (id, username, password, role, characters)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, username.trim(), hashedPassword, role || 'player', JSON.stringify(characters || [])]
    );

    const result = await pool.query(
      'SELECT id, username, role, characters FROM accounts WHERE id = $1',
      [id]
    );

    res.json(result.rows[0]);
  } catch (e) {
    console.error('register error:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


io.on('connection', (socket) => {
  console.log('🟢 Игрок подключился:', socket.id);

  // --- Аккаунты ---
  socket.on('get_accounts', async (cb) => {
  try {
    // Никогда не отдаём хэш пароля клиенту
    const res = await pool.query(
      'SELECT id, username, role, characters FROM accounts'
    );
    cb(res.rows);
  } catch (e) {
    console.error('get_accounts error:', e);
    cb([]);
  }
});


  socket.on('save_account', async (acc) => {
  try {
    const bcrypt = require('bcrypt');

    // Хэшируем только если пароль изменился (не является уже хэшем)
    let hashedPassword = acc.password;
    const isAlreadyHashed = acc.password && acc.password.startsWith('$2b$');
    if (!isAlreadyHashed && acc.password) {
      hashedPassword = await bcrypt.hash(acc.password, 10);
    }

    await pool.query(
      `INSERT INTO accounts (id, username, password, role, characters)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
       SET username = $2, password = $3, role = $4, characters = $5`,
      [acc.id, acc.username, hashedPassword, acc.role || 'player', JSON.stringify(acc.characters || [])]
    );

    // Никогда не отдаём пароль клиенту
    const res = await pool.query(
      'SELECT id, username, role, characters FROM accounts'
    );
    io.emit('accounts_updated', res.rows);
  } catch (e) {
    console.error('Ошибка сохранения аккаунта:', e);
  }
});


  // --- Сессии ---
  socket.on('get_sessions', async (cb) => {
    try {
      const res = await pool.query('SELECT state FROM sessions');
      cb(res.rows.map(r => r.state));
    } catch (e) {
      console.error('get_sessions error:', e);
      cb([]);
    }
  });

  socket.on('get_session', async (id, cb) => {
    if (activeSessions[id]) return cb(activeSessions[id]);
    try {
      const res = await pool.query('SELECT state FROM sessions WHERE id = $1', [id]);
      if (res.rows.length > 0) {
        activeSessions[id] = res.rows[0].state;
        cb(res.rows[0].state);
      } else {
        cb(null);
      }
    } catch (e) {
      console.error('get_session error:', e);
      cb(null);
    }
  });

  socket.on('create_session', async (sess) => {
    try {
      await pool.query(
        'INSERT INTO sessions (id, name, state) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET state = $3',
        [sess.id, sess.name, sess]
      );
      activeSessions[sess.id] = sess;
      const res = await pool.query('SELECT state FROM sessions');
      io.emit('sessions_updated', res.rows.map(r => r.state));
    } catch (e) {
      console.error('create_session error:', e);
    }
  });

  socket.on('delete_session', async (id) => {
    try {
      await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
      delete activeSessions[id];
      const res = await pool.query('SELECT state FROM sessions');
      io.emit('sessions_updated', res.rows.map(r => r.state));
    } catch (e) {
      console.error('delete_session error:', e);
    }
  });

  socket.on('join_session', async (id) => {
    socket.join(id);
    if (!activeSessions[id]) {
      try {
        const res = await pool.query('SELECT state FROM sessions WHERE id = $1', [id]);
        if (res.rows.length > 0) activeSessions[id] = res.rows[0].state;
        else activeSessions[id] = { id, tokens: {}, chatMessages: [] };
      } catch (e) {
        console.error('join_session error:', e);
        activeSessions[id] = { id, tokens: {}, chatMessages: [] };
      }
    }
    socket.emit('session_full_state', activeSessions[id]);
  });

  // --- Ядро реального времени с подтверждением ---
  socket.on('update_session', async ({ sessionId, updates, updateId }) => {
    if (!activeSessions[sessionId]) {
      try {
        const res = await pool.query('SELECT state FROM sessions WHERE id = $1', [sessionId]);
        if (res.rows.length > 0) {
          activeSessions[sessionId] = res.rows[0].state;
        } else {
          activeSessions[sessionId] = { id: sessionId, tokens: {} };
        }
      } catch (err) {
        console.error('Ошибка защиты сессии при обновлении:', err);
        activeSessions[sessionId] = { id: sessionId, tokens: {} };
      }
    }

    try {
      // Применяем изменения
      for (const key in updates) {
        const val = updates[key];
        if (key.includes('.')) {
          const parts = key.split('.');
          let curr = activeSessions[sessionId];
          for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
          }
          if (val === '__DELETE_FIELD__') delete curr[parts[parts.length - 1]];
          else curr[parts[parts.length - 1]] = val;
        } else {
          if (val === '__DELETE_FIELD__') delete activeSessions[sessionId][key];
          else activeSessions[sessionId][key] = val;
        }
      }

      // Рассылаем остальным
      socket.to(sessionId).emit('session_update', updates);

      // Подтверждение отправителю
      if (updateId) {
        socket.emit('update_session_ack', { updateId, success: true });
      }

      scheduleDbSave(sessionId);
    } catch (error) {
      console.error('Error applying update:', error);
      if (updateId) {
        socket.emit('update_session_ack', { updateId, success: false, error: error.message });
      }
    }
  });

  socket.on('broadcast', ({ sessionId, event, payload }) => {
    socket.to(sessionId).emit('broadcast', { event, payload });
  });

  // --- Сцены ---
  socket.on('get_scenes', async (cb) => {
    try {
      const res = await pool.query('SELECT map_config FROM scenes');
      cb(res.rows.map(r => r.map_config));
    } catch (e) {
      console.error('get_scenes error:', e);
      cb([]);
    }
  });

  socket.on('save_scene', async (scene) => {
    try {
      await pool.query(
        'INSERT INTO scenes (id, name, map_config) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = $2, map_config = $3',
        [scene.id, scene.name, scene]
      );
      const res = await pool.query('SELECT map_config FROM scenes');
      io.emit('scenes_updated', res.rows.map(r => r.map_config));
    } catch (e) {
      console.error('save_scene error:', e);
    }
  });

  // Обработчик удаления сцены
  socket.on('delete_scene', async (sceneId) => {
    try {
      await pool.query('DELETE FROM scenes WHERE id = $1', [sceneId]);
      const res = await pool.query('SELECT map_config FROM scenes');
      io.emit('scenes_updated', res.rows.map(r => r.map_config));
    } catch (e) {
      console.error('delete_scene error:', e);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 Игрок отключился:', socket.id);
  });
});

server.listen(3000, '0.0.0.0', () => console.log(`🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ 3000`));