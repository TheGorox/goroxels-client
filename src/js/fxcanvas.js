import globals from './globals'
import {
    boardToChunk
} from './utils'

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

    remove(){
        this.removed = true;
    }
}

export class FXRenderer {
    constructor() {
        this.fxList = [];
        this.ctx = globals.fxCtx;

        this.needRender = true;
        this.needClear = false;
    }

    add(fx){
        this.fxList.push(fx);

        this.needRender = true;
    }

    render() {
        if(!this.needRender) return;

        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        
        this.needRender = false;

        this.fxList.slice().forEach(fx => {
            if(fx.removed) return this.remove(fx);

            let r = fx.render(this.ctx);

            if(r == 2){
                this.remove(fx);
            }else if(r == 0){
                this.needRender = true;
            }
        })
    }

    remove(fx){
        let idx = this.fxList.indexOf(fx);
        if(idx != -1){
            this.fxList.splice(idx, 1);
        }
    }
}