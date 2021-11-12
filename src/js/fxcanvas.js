import globals from './globals';

const NOT_FINISHED = 0,
    FINISHED = 1,
    DELETED = 2;

export class FX {
    constructor(renderFunc) {
        this.renderFunc = renderFunc;

        this.removed = false;
    }

    render(ctx) {
        return this.renderFunc(ctx);
    }

    remove() {
        this.removed = true;
    }
}

export class FXRenderer {
    constructor() {
        // three layers
        this.fxList = [[], [], []];
        this.ctx = globals.fxCtx;

        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
        this.ctx.oImageSmoothingEnabled = false;

        this.needRender = true;
        this.needClear = false;
    }

    add(fx, layer = 0) {
        this.fxList[layer].push(fx);

        this.needRender = true;
    }

    /*
      You can request it by returning zero in rendering
      functions or explicitly ↓
    */
    requestRender() {
        this.needRender = true;
    }

    render() {
        if (!this.needRender) return;

        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        this.needRender = false;

        for (let layer = 0; layer < this.fxList.length; layer++) {
            this.fxList[layer].forEach(fx => {
                if (fx.removed) return this.remove(fx);

                let r = fx.render(this.ctx);

                /*
                    0 - not finished yet
                    1 - finished but continue rendering
                    2 - finished
                */

                if (r == 2) {
                    this.remove(fx);
                } else if (r == 0) {
                    this.needRender = true;
                }
            })
        }
    }

    remove(fx) {
        for (let layer = 0; layer < this.fxList.length; layer++) {
            let idx = this.fxList[layer].indexOf(fx);
            if (idx != -1) {
                this.fxList[layer][idx].remove();
                this.fxList[layer].splice(idx, 1);
                this.needRender = true;
                break
            }
        }

    }
}