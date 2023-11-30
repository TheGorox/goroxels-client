import Pattern from './Pattern';
import {
    chunkSize,
    bgrPalette,
    game
} from './config'
import protectedPatternUrl from '../img/protectedPattern.png';

export default class Chunk {
    constructor(x, y, buffer) {
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

        // chunksized means the canvas with sizes of the chunk, filled with "protected" pattern
        this.protectedPatternChunkSized = null;
        this._protectedPattern = new Pattern(protectedPatternUrl);
        this._protectedPattern.onload = () => {
            this.needRender = true;
            // pattern shift is an offset, to shift
            // the texture for current chunk, because it might not
            // be dividable by chunk size (pattern misjoint between chunks in result)
            const patternShift = [
                (this.x * this.width) % this._protectedPattern.canvas.width,
                (this.y * this.height) % this._protectedPattern.canvas.height
            ]

            this.protectedPatternChunkSized = this._protectedPattern.createFilledCanvas(this.width, this.height, patternShift[0], patternShift[1]);
        }

        this.pCanvas = document.createElement('canvas');
        this.pCanvas.width = this.pCanvas.height = chunkSize;

        this.pCtx = this.pCanvas.getContext('2d');
        this.pImgData = this.pCtx.createImageData(chunkSize, chunkSize);
        this.pView = new Uint32Array(this.pImgData.data.buffer);

        this.needRender = true;

        this.fromBuffer(buffer);
    }

    render() {
        if (this.needRender) {
            this.needRender = false;
            this.ctx.putImageData(this.imgData, 0, 0);

            if (game.showProtected) {
                this.ctx.globalAlpha = 0.7;

                this.pCtx.putImageData(this.pImgData, 0, 0);
                if(this.protectedPatternChunkSized !== null){
                    this.pCtx.globalCompositeOperation = 'source-in';
                    this.pCtx.drawImage(this.protectedPatternChunkSized, 0, 0);
                    this.pCtx.globalCompositeOperation = 'source-over'; // back to default
                }

                this.ctx.drawImage(this.pCanvas, 0, 0);

                this.ctx.globalAlpha = 1;
            }
        }
    }

    fromBuffer(buf) {
        let col, isProtected;
        for (let i = 0; i < buf.byteLength; i++) {
            col = buf[i];
            isProtected = col & 0x80;

            isProtected && (this.pView[i] = 0xFFFF0000);
            this.view[i] = bgrPalette[col & 0x7F];
        }
    }

    get(x, y) {
        return this.view[x + y * chunkSize]
    }

    set(x, y, c) {
        const i = x + y * chunkSize

        this.view[i] = c;

        this.needRender = true;
    }

    setProtect(x, y, state) {
        const i = x + y * chunkSize;
        this.pView[i] = state ? 0xFFFF0000 : 0;

        this.needRender = true;
    }

    getProtect(x, y) {
        const i = x + y * chunkSize;
        return !!this.pView[i];
    }
}