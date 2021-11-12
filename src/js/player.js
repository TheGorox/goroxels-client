import Bucket from './Bucket';
import globals from './globals';
import { get, getOrDefault, set } from './utils/localStorage';

export default {
    x: 0,
    y: 0,
    color: +getOrDefault('color1', -1),
    brushSize: 1,
    secondCol: +getOrDefault('color2', -1),
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
        
        if(localStorage.palSize){
            const size = +localStorage.palSize;
            $('.selected').css('width', size+5).css('height', size+5);
        }

        set('color1', id);
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

        if(localStorage.palSize){
            const size = +localStorage.palSize;
            $('.selectedSecond').css('width', size+2).css('height', size+2);
        }

        set('color2', id);
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
    placedCount: +get('placedCount') || 0
}