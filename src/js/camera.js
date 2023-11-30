import globals from './globals'
import {
    boardWidth,
    boardHeight
} from './config'
import EventEmitter from 'events';
import { getOrDefault, setLS } from './utils/localStorage';

const camera = {
    x: null, y: null,
    zoom: null,
    minX: null, minY: null, 
    maxX: null, maxY: null,

    minZoom: 0.1,
    maxZoom: 64,

    // when it's needed to disable moving
    noMoving: false,

    init(){
        Object.assign(this, {
            x: +getOrDefault('posX', 0, true),
            y: +getOrDefault('posY', 0, true),

            zoom: +getOrDefault('zoom', 1, true),

            minX: -boardWidth/2,
            minY: -boardHeight/2,
            maxX: boardWidth/2,
            maxY: boardHeight/2,
        })
        if(isNaN(this.x) || isNaN(this.y) || isNaN(this.zoom)){
            this.x = 0;
            this.y = 0;
            this.zoom = 1;
        }
    },

    centerOn(x, y){
        globals.renderer.needRender = true;
        if(this.noMoving) return;
        
        this.x = x - this.maxX;
        this.y = y - this.maxY;

        this.clampPos();
    },

    moveTo(movx, movy){
        globals.renderer.needRender = true;
        if(this.noMoving) return;

        this.x += movx;
        this.y += movy;

        this.clampPos();
    },

    clampPos(){
        this.x = Math.min(Math.max(this.x, this.minX), this.maxX);
        this.y = Math.min(Math.max(this.y, this.minY), this.maxY);
    },

    zoomTo(dir){
        if(dir < 0){
            this.zoom = this.zoom * 2 | 0 || 1;
        }else{
            this.zoom = this.zoom / 2;
        }
        this.checkZoom();

        this.emit('zoom', this.zoom);

        globals.renderer.needRender = true;
        globals.fxRenderer.needRender = true;

        globals.renderer.preRender();
    },

    checkZoom(){
        this.zoom = Math.min(Math.max(this.zoom, this.minZoom), this.maxZoom)
    }, 

    disableMove(){
        this.noMoving = true;
    },

    enableMove(){
        this.noMoving = false;
    },

    __proto__: new EventEmitter
}

let lastX, lastY, lastZ;
setInterval(() => {
    const newX = camera.x,
        newY = camera.y,
        newZ = camera.zoom;

    if(lastX != newX) setLS('posX', newX, true);
    if(lastY != newY) setLS('posY', newY, true);
    if(lastZ != newZ) setLS('zoom', newZ, true);

    lastX = newX; lastY = newY; lastZ = newZ;
}, 3000);

export default (window.camera = camera);