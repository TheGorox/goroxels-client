import globals from './globals'
import {
    minZoom,
    maxZoom
} from './config'

export default window.camera = {
    x: 0,
    y: 0,
    zoom: 1,

    centerOn(x, y){
        this.x = x;
        this.y = y;

        globals.renderer.render();
    },

    zoomTo(dir){
        if(dir < 0){
            this.zoom = this.zoom * 2 | 0 || 1;
        }else{
            this.zoom = this.zoom / 2;
        }
        this.checkZoom();
    },

    checkZoom(){
        this.zoom = Math.min(Math.max(this.zoom, minZoom), maxZoom)
    }
}