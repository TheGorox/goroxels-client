import {
    chunkSize,
    bgrPalette
} from './config'

export default class Chunk{
    constructor(x, y, buffer){
        this.x = x;
        this.y = y;

        this.width = chunkSize;
        this.height = chunkSize;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = chunkSize;

        this.ctx = this.canvas.getContext('2d');

        this.imgData = this.ctx.createImageData(chunkSize, chunkSize);
        this.view = new Uint32Array(this.imgData.data.buffer);

        // protected
        this.pCanvas = document.createElement('canvas');
        this.pCanvas.width = this.pCanvas.height = chunkSize;

        this.pCtx = this.pCanvas.getContext('2d');
        this.pImgData = this.pCtx.createImageData(chunkSize, chunkSize);
        this.pView = new Uint32Array(this.pImgData.data.buffer);

        this.needRender = true;
        this.showProtected = false;

        this.fromBuffer(buffer);
    }

    render(){
        if(this.needRender){
            this.needRender = false;
            this.ctx.putImageData(this.imgData, 0, 0);

            if(this.showProtected){
                this.ctx.globalAlpha = 0.5;

                this.pCtx.putImageData(this.pImgData,0,0);
                this.ctx.drawImage(this.pCanvas, 0, 0);

                this.ctx.globalAlpha = 1;
            }
        }
    }

    fromBuffer(buf){
        let col, isProtected;
        for(let i = 0; i < buf.byteLength; i++){
            col = buf[i];
            isProtected = col & 0x80;

            isProtected && (this.pView[i] = 0xFFFF0000);
            this.view[i] = bgrPalette[col & 0x7F];
        }
    }

    get(x, y){
        return this.view[x + y * chunkSize]
    }

    set(x, y, c){
        const i = x + y * chunkSize

        this.view[i] = c;

        this.needRender = true;
    }

    setProtect(x, y, state){
        const i = x + y * chunkSize;
        this.pView[i] = state ? 0xFFFF0000 : 0;

        this.needRender = true;
    }

    getProtect(x, y){
        const i = x + y * chunkSize;
        return !!this.pView[i];
    }
}