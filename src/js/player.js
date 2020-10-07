import { palette } from './config';
import Bucket from './Bucket';
import globals from './globals';

export default window.player = {
    x: 0,
    y: 0,
    color: Math.random() * palette.length | 0,
    secondCol: -1,
    switchColor(id){
        this.color = id;
        globals.fxRenderer.needRender = true;

        $('.paletteColor.selected').removeClass('selected');
        if(id !== -1){
            $('#col' + id).addClass('selected');
        }
        
        if(localStorage.palSize){
            const size = +localStorage.palSize;
            $('.selected').css('width', size+5).css('height', size+5);
        }
    },
    switchSecondColor(id){
        this.secondCol = id;
        globals.fxRenderer.needRender = true;

        $('.paletteColor.selectedSecond').removeClass('selectedSecond');
        if(id !== -1){
            $('#col' + id).addClass('selectedSecond');
        }

        if(localStorage.palSize){
            const size = +localStorage.palSize;
            $('.selectedSecond').css('width', size+2).css('height', size+2);
        }
    },
    swapColors(){
        const temp = this.color;
        this.switchColor(this.secondCol);
        this.switchSecondColor(temp);
    },
    bucket: null,
    updateBucket([delay, max]) {
        this.bucket = new Bucket(delay, max);
    },
    placed: [],
    maxPlaced: 500
}