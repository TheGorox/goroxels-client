import globals from './globals'
import {
    minZoom,
    maxZoom,
    boardWidth,
    boardHeight
} from './config'


export default window.camera = {
    x: 0,
    y: 0,
    zoom: 1,

    minX: -boardWidth/2,
    minY: -boardHeight/2,
    maxX: boardWidth/2,
    maxY: boardHeight/2,

    centerOn(x, y){
        this.x = x;
        this.y = y;

        this.checkPos();

        globals.renderer.needRender = true;
        globals.fxRenderer.needRender = true;
    },

    moveTo(movx, movy){
        this.x += movx;
        this.y += movy;

        this.checkPos();

        globals.renderer.needRender = true;
    },

    checkPos(){
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

        globals.renderer.needRender = true;
        globals.fxRenderer.needRender = true;
    },

    checkZoom(){
        this.zoom = Math.min(Math.max(this.zoom, minZoom), maxZoom)
    }
}