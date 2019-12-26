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
            this.zoom = Math.min(this.zoom * 2 | 0 || 1, maxZoom);
        }else{
            this.zoom = Math.max(this.zoom / 2, minZoom);
        }
    }
}