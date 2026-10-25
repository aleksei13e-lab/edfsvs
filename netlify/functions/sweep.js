// Запланированная функция (@daily): очистка отключена.
// Кроссворды хранятся навсегда.
import { crosswordsStore } from './_lib/store.js';

export default async () => {
  // Очистка отключена — ничего не удаляем
  console.log(JSON.stringify({ swept: 0, message: 'retention disabled — crosswords kept forever' }));
  return new Response(JSON.stringify({ swept: 0 }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
};

export const config = {
  schedule: '@daily'
};
