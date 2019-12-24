import {
    chunkSize,
    argbPalette
} from './config'

export default class Chunk{
    constructor(x, y, buffer){
        this.x = x;
        this.y = y;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = chunkSize;

        this.ctx = this.canvas.getContext('2d');

        this.imgData = this.ctx.createImageData(chunkSize, chunkSize);
        this.view = new Uint32Array(this.imgData.data.buffer);

        this.needRender = true;

        this.fromBuffer(buffer);
    }

    render(){
        if(this.needRender){
            this.needRender = false;
            this.ctx.putImageData(this.imgData, 0, 0);
        }
    }

    fromBuffer(buf){
        for(let i = 0; i < buf.byteLength; i++){
            this.view[i] = argbPalette[buf[i]]
        }
    }

    get(x, y){
        return this.view[x + y * chunkSize]
    }

    set(x, y, argb){
        this.needRender = true;
        this.view[x + y * chunkSize] = argb
    }
}