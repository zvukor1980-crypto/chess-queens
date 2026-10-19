/* Web Worker: считает ход компьютера, не блокируя интерфейс */
importScripts('chess.js', 'engine.js');
self.onmessage = e => {
  const { id, moves, level, fen } = e.data;
  try {
    const r = self.CQEngine.bestMove(moves, level, fen);
    self.postMessage({ id, ok: true, result: r });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
