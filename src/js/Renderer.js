import ChunkPlaceholder from '../img/chunkPlaceholder.png';
import camera from './camera';
import { chunkSize, hexPalette } from './config';
import globals from './globals';
import Pattern from './Pattern';
import { getVisibleChunks } from './utils/camera';
import {
    halfMap,
    insanelyLongMobileBrowserCheck
} from './utils/misc';
import template from './template';
import shapes from './utils/shapes';
import player from './player';

const isMobile = insanelyLongMobileBrowserCheck();


export default class Renderer {
    /**
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.canvas = this.ctx.canvas;

        this.chunkPlaceholderPattern = new Pattern(ChunkPlaceholder);
        this.chunkPlaceholderPattern.onload = () => {
            this.needRender = true;
        }

        this.needRender = true;

        this.preRendered = {
            brush: {
                canvas: undefined,
                ctx: undefined,
                imageData: undefined,

                circle: undefined,
            }
        }

        this.preRender();
    }

    preRender(){
        this.preRenderBrush(player.brushSize, camera.zoom);
    }

    preRenderBrush(){
        const size = player.brushSize,
            zoom = camera.zoom;

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = zoom*(size+1);
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        const r = size/2;

        const circle = shapes.filledCircle(0, 0, r);
        let circleMatrix = [];
        for(let y = 0; y < size+1; y++){
            circleMatrix.push((new Array(size+1)).fill(0))
        }
        
        circle.forEach(([x, y]) => {
            circleMatrix[x+r][y+r] = 1;
        })
        
        ctx.beginPath();
        ctx.lineWidth = zoom / 5;
        ctx.strokeStyle = hexPalette[player.color];
        ctx.lineCap = 'square';

        ctx.fillStyle = 'blue';

        for(let x = 0; x < size; x++){
            for(let y = 0; y < size; y++){
                if(isBound(x, y)) continue;

                let upper = isBound(x, y-1),
                    left = isBound(x - 1, y),
                    right = isBound(x + 1, y),
                    bottom = isBound(x, y + 1);

                if(upper){
                    ctx.moveTo(x*zoom, y*zoom);
                    ctx.lineTo((x+1)*zoom, y*zoom);
                }
                if(left){
                    ctx.moveTo(x*zoom, y*zoom);
                    ctx.lineTo(x*zoom, (y+1)*zoom);
                }
                if(right){
                    ctx.moveTo((x+1)*zoom, y*zoom);
                    ctx.lineTo((x+1)*zoom, (y+1)*zoom);
                }
                if(bottom){
                    ctx.moveTo((x+1)*zoom, (y+1)*zoom);
                    ctx.lineTo(x*zoom, (y+1)*zoom);
                }
            }
        }

        ctx.stroke();
        ctx.closePath();

        function isBound(x, y){
            // check is pixel opaque/out of array

            if(x < 0 || x >= size || y < 0 || y >= size) return true;

            return !circleMatrix[x][y];
        }

        this.preRendered.brush.canvas = canvas;
        this.preRendered.brush.ctx = canvas;
        this.preRendered.brush.imageData = canvas;
        this.preRendered.brush.canvas = canvas;
        this.preRendered.brush.circle = circle;
    }

    requestRender(){
        if(this.needRender){
            this.needRender = false;

            this.render()
        }

        globals.fxRenderer.render();
    }

    correctSmoothing(){
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
        // smooth when zoom < 1, pixelated otherwise
        // TODO move to camera
        this.correctSmoothing();

        let visibleChunks = getVisibleChunks();

        // clear veiwport
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let camX = camera.x + halfMap[0] - ((this.canvas.width >> 1) / camera.zoom);
        let camY = camera.y + halfMap[1] - ((this.canvas.height >> 1) / camera.zoom);

        let zoom = camera.zoom;

        this.ctx.save();
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-camX, -camY)

        visibleChunks.forEach(chunkCord => {
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

        template.render()
    }
}