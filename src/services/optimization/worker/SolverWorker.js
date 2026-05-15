// src/services/optimization/worker/SolverWorker.js

self.onmessage = async (event) => {

  const { id, cmd, payload } = event.data;

  if (cmd === 'solve') {

    // placeholder

    const result = {

      ok: true,

      iterations: 0,

    };

    self.postMessage({ id, result });

  }

};
