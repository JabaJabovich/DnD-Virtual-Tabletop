import { io } from 'socket.io-client';

export const SERVER_URL = 'http://45.131.186.23:3000';
export const socket = io(SERVER_URL);

export const uploadCanvasToStorage = async (canvas, folderName = 'maps') => {
  return new Promise(async (resolve) => {
    const base64Data = canvas.toDataURL('image/jpeg', 0.8);
    try {
      const res = await fetch(`${SERVER_URL}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Data, folder: folderName })
      });
      const data = await res.json();
      resolve(`${SERVER_URL}${data.url}`);
    } catch (err) {
      console.error('Ошибка загрузки файла на сервер:', err);
      resolve(base64Data); 
    }
  });
};