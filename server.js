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
app.post('/upload', (req, res) => {
  const { imageBase64, folder } = req.body;
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
  const filePath = path.join(UPLOADS_DIR, folder, fileName);
  fs.writeFile(filePath, base64Data, 'base64', (err) => {
    if (err) return res.status(500).send('Ошибка');
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
let saveTimeout = null;
let isSaving = false;

function scheduleDbSave() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(async () => {
    if (isSaving) {
      saveTimeout = null;
      scheduleDbSave();
      return;
    }
    isSaving = true;
    try {
      for (const [id, state] of Object.entries(activeSessions)) {
        await pool.query('UPDATE sessions SET state = $1 WHERE id = $2', [state, id]);
      }
    } catch (err) {
      console.error('Ошибка записи в БД:', err);
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

io.on('connection', (socket) => {
  console.log('🟢 Игрок подключился:', socket.id);

  // --- Аккаунты ---
  socket.on('get_accounts', async (cb) => {
    try {
      const res = await pool.query('SELECT * FROM accounts');
      cb(res.rows);
    } catch (e) {
      console.error('get_accounts error:', e);
      cb([]);
    }
  });

  socket.on('save_account', async (acc) => {
    try {
      await pool.query(
        'INSERT INTO accounts (id, username, password, role, characters) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET username = $2, password = $3, role = $4, characters = $5',
        [acc.id, acc.username, acc.password, acc.role || 'player', JSON.stringify(acc.characters || [])]
      );
      const res = await pool.query('SELECT * FROM accounts');
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
  socket.on('update_session', ({ sessionId, updates, updateId }) => {
    if (!activeSessions[sessionId]) {
      activeSessions[sessionId] = { id: sessionId, tokens: {} };
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

      scheduleDbSave();
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