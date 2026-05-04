/**
 * createCpmWorker.ts
 *
 * Worker factory that returns a Web Worker running a CPM implementation.
 *
 * The worker accepts a message:
 *  { id: 'compute', tasks: Array<{ id, duration, dependencies: Array<{ predecessorId, type?, lag? }> }> }
 *
 * The worker responds:
 *  { id: 'result', metrics: { [taskId]: { ES, EF, LS, LF, TF } }, criticalIds: string[] }
 *
 * Using a blob worker keeps the project dependency-free and works with the environment bundler.
 */

/**
 * createCpmWorker
 * Create and return a Web Worker which computes CPM metrics.
 * @returns Worker
 */
export function createCpmWorker(): Worker {
  const workerCode = `
  // Minimal CPM implementation inside the worker scope
  self.onmessage = function (ev) {
    const msg = ev.data;
    if (!msg || msg.id !== 'compute') return;
    const tasks = msg.tasks || [];
    // Build indexed map
    const map = new Map();
    tasks.forEach(t => {
      map.set(t.id, {
        id: t.id,
        duration: Math.max(1, Number(t.duration) || 1),
        deps: (t.dependencies || []).map(d => ({ predecessorId: d.predecessorId, lag: d.lag || 0 }))
      });
    });

    // Build adjacency (successors) and predecessor lists
    const preds = new Map();
    const succs = new Map();
    tasks.forEach(t => {
      preds.set(t.id, []);
      succs.set(t.id, []);
    });
    tasks.forEach(t => {
      const arr = t.dependencies || [];
      arr.forEach(d => {
        if (!map.has(d.predecessorId)) return;
        preds.get(t.id).push(d.predecessorId);
        succs.get(d.predecessorId).push(t.id);
      });
    });

    // Topological order via Kahn
    const inDegree = new Map();
    tasks.forEach(t => inDegree.set(t.id, (preds.get(t.id) || []).length));
    const q = [];
    inDegree.forEach((v, k) => { if (v === 0) q.push(k); });
    const topo = [];
    while (q.length) {
      const n = q.shift();
      topo.push(n);
      (succs.get(n) || []).forEach(s => {
        inDegree.set(s, inDegree.get(s) - 1);
        if (inDegree.get(s) === 0) q.push(s);
      });
    }
    // If cycle -> fallback: use input order
    if (topo.length !== tasks.length) {
      topo.length = 0;
      tasks.forEach(t => topo.push(t.id));
    }

    // Forward pass (ES, EF)
    const metrics = {};
    topo.forEach(id => {
      const entry = map.get(id);
      const p = preds.get(id) || [];
      const ES = p.length ? Math.max(...p.map(pid => metrics[pid].EF)) : 0;
      const EF = ES + entry.duration;
      metrics[id] = { ES, EF, LS: Infinity, LF: Infinity, TF: 0 };
    });

    // Backward pass (LS, LF)
    // Initialize LF of terminal nodes to their EF
    const reverse = topo.slice().reverse();
    reverse.forEach(id => {
      const s = succs.get(id) || [];
      if (!s.length) {
        // terminal
        metrics[id].LF = metrics[id].EF;
        metrics[id].LS = metrics[id].LF - map.get(id).duration;
      } else {
        const minLF = Math.min(...s.map(sid => metrics[sid].LS));
        metrics[id].LF = minLF;
        metrics[id].LS = metrics[id].LF - map.get(id).duration;
      }
      metrics[id].TF = metrics[id].LS - metrics[id].ES;
    });

    const criticalIds = Object.keys(metrics).filter(k => metrics[k].TF === 0);

    self.postMessage({ id: 'result', metrics, criticalIds });
  };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  // Release URL later (worker keeps a reference); leave it to the caller to terminate worker
  return worker;
}
