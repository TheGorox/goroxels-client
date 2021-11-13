import Bucket from './Bucket';
import globals from './globals';
import { getLS, getOrDefault, setLS } from './utils/localStorage';

export default {
    x: 0,
    y: 0,
    color: +getOrDefault('color1', -1, true),
    brushSize: 1,
    secondCol: +getOrDefault('color2', -1, true),
    id: -1,
    init(){
        this.switchColor(this.color, true);
        this.switchSecondColor(this.secondCol, true);
    },
    switchColor(id, initial=false){
        if(this.color === id && !initial)
            id = this.color = -1;
        else
            this.color = id;
        globals.fxRenderer.needRender = true;
        globals.renderer.preRender();

        $('.paletteColor.selected').removeClass('selected');
        if(id !== -1){
            $('#col' + id).addClass('selected');
        }

        setLS('color1', id, true);
    },
    switchSecondColor(id, initial){
        if(this.secondCol === id && !initial)
            id = this.secondCol = -1;
        else
            this.secondCol = id;
        globals.fxRenderer.needRender = true;
        globals.renderer.preRender();

        $('.paletteColor.selectedSecond').removeClass('selectedSecond');
        if(id !== -1){
            $('#col' + id).addClass('selectedSecond');
        }

        setLS('color2', id, true);
    },
    swapColors(){
        const temp = this.color;
        this.switchColor(this.secondCol);
        this.switchSecondColor(temp);
    },
    resetColors(){
        this.switchColor(-1);
        this.switchSecondColor(-1);
    },
    bucket: null,
    updateBucket([delay, max]) {
        this.bucket = new Bucket(delay, max);
    },
    placed: [],
    maxPlaced: isNaN(+localStorage['maxPlaced']) ? 500 : +localStorage['maxPlaced'],
    placedCount: +getLS('placedCount', true) || 0
}