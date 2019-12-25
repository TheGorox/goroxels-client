import {
    getVisibleChunks,
    halfMap,
    boardToScreenSpace
} from './utils';
import globals from './globals';
import camera from './camera';
import player from './player';
import {
    chunkSize
} from './config'

export default class Renderer {
    /**
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    constructor(ctx) {
        this.ctx = ctx;
    }

    render() {
        if (camera.zoom < 1) {
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.canvas.style.imageRendering = 'auto'
        } else {
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.canvas.style.imageRendering = 'pixelated'
        }
        let chunks = getVisibleChunks();
        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

        this.ctx.scale(camera.zoom, camera.zoom);
        //this.ctx.translate(camera.x % chunkSize, camera.y % chunkSize);

        let camX = camera.x + halfMap[0] - (window.innerWidth / 2 / camera.zoom);
        let camY = camera.y + halfMap[1] - (window.innerHeight / 2 / camera.zoom);

        chunks.forEach(chunkCord => {
            let [cx, cy] = chunkCord;

            let chunk = globals.chunkManager.getChunk(cx, cy);
            if (!chunk) return;

            let offX = chunk.x * chunkSize - camX;
            let offY = chunk.y * chunkSize - camY;

            chunk.render();
            this.ctx.drawImage(chunk.ctx.canvas, offX, offY);
        })

        this.ctx.scale(1 / camera.zoom, 1 / camera.zoom);

        this.ctx.save();

        if (player.color != -1 && camera.zoom > 1) {
            this.ctx.strokeStyle = 'black';

            let [x, y] = boardToScreenSpace(player.x | 0, player.y | 0);

            this.ctx.strokeRect(x, y, camera.zoom, camera.zoom);
        }

        this.ctx.restore();
    }
}