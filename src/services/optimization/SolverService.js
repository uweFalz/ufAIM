// src/services/optimization/SolverService.js

export class SolverService {

  constructor() {

    this.worker = new Worker(

      new URL('./worker/SolverWorker.js', import.meta.url),

      { type: 'module' }

    );

  }

  solve(payload) {

    return new Promise((resolve) => {

      const id = crypto.randomUUID();

      const onMessage = (event) => {

        if (event.data?.id !== id) return;

        this.worker.removeEventListener('message', onMessage);

        resolve(event.data.result);

      };

      this.worker.addEventListener('message', onMessage);

      this.worker.postMessage({

        id,

        cmd: 'solve',

        payload,

      });

    });

  }

}
