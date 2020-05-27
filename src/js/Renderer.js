import ChunkPlaceholder from '../img/chunkPlaceholder.png';
import camera from './camera';
import { chunkSize, hexPalette } from './config';
import globals from './globals';
import Pattern from './Pattern';
import player from './player';
import { boardToScreenSpace, getVisibleChunks, halfMap, mod, insanelyLongMobileBrowserCheck } from './utils';

const isMobile = insanelyLongMobileBrowserCheck();


export default class Renderer {
    /**
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.canvas = this.ctx.canvas;

        this.needRender = true;

        this.chunkPlaceholderPattern = new Pattern(ChunkPlaceholder);
        this.chunkPlaceholderPattern.onload = () => {
            this.needRender = true;
        }
    }

    requestRender(){
        if(!this.needRender) return;
        this.needRender = false;

        this.render()
    }

    correctSmoothing(){
        // todo move it to camera
        if(isMobile) return;

        if (camera.zoom < 1) {
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.canvas.style.imageRendering = 'auto'
        } else {
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.canvas.style.imageRendering = 'pixelated'
        }
    }

    render() {
        this.correctSmoothing();

        let chunks = getVisibleChunks();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

        let camX = camera.x + halfMap[0] - ((this.canvas.width >> 1) / camera.zoom);
        let camY = camera.y + halfMap[1] - ((this.canvas.height >> 1) / camera.zoom);

        let zoom = camera.zoom;

        this.ctx.save();
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-camX, -camY)

        chunks.forEach(chunkCord => {
            let [cx, cy] = chunkCord;

            let offX = cx * chunkSize;
            let offY = cy * chunkSize;


            if (!globals.chunkManager.hasChunk(cx, cy)){
                globals.chunkManager.loadChunk(cx, cy);
                
                if(this.chunkPlaceholderPattern.loaded)
                    this.ctx.drawImage(this.chunkPlaceholderPattern.canvas, offX, offY, chunkSize, chunkSize);

                return
            }
            
            let chunk = globals.chunkManager.getChunk(cx, cy);

            chunk.render();
            this.ctx.drawImage(chunk.ctx.canvas, offX, offY);
        });

        this.ctx.restore();

        this.ctx.save();

        if (player.color != -1 && zoom > 1) {
            this.ctx.strokeStyle = 'black';
            this.ctx.fillStyle = hexPalette[player.color];
            this.ctx.lineWidth = zoom / 25

            let [x, y] = boardToScreenSpace(player.x, player.y);

            this.ctx.fillRect(x, y, zoom, zoom);
            this.ctx.strokeRect(x, y, zoom, zoom);
        }

        this.ctx.restore();

        globals.fxRenderer.render();
    }
}