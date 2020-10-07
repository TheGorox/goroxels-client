import camera from './camera';
import {
    halfMap
} from './utils/misc'

let winWid = window.innerWidth / 2,
    winHei = window.innerHeight / 2;

window.addEventListener('resize', () => {
    winWid = window.innerWidth / 2;
    winHei = window.innerHeight / 2;
})

import {
    urlInput,
    xInput,
    yInput,
    opacInput
} from './elements';

const widthRegEx = /width=(\d+)$/;

export default {
    element: document.getElementById('template'),

    x: 0,
    y: 0,

    render() {
        let camX = camera.x + halfMap[0] - this.x - (winWid / camera.zoom);
        let camY = camera.y + halfMap[1] - this.y - (winHei / camera.zoom);
        
        camX *= camera.zoom;
        camY *= camera.zoom;

        this.element.style.left = -camX + 'px';
        this.element.style.top = -camY + 'px';
        this.element.style.transform = 'scale(' + camera.zoom + ',' + camera.zoom + ')';
    },

    update(){
        this.x = parseInt(xInput.val(), 10);
        this.y = parseInt(yInput.val(), 10);

        this.element.style.opacity = opacInput.val();

        const url = urlInput.val();
        let match;
        if(match = url.match(widthRegEx)){
            this.element.style.width = match[1] + 'px';
        }else{
            this.element.style.width = 'unset';
        }

        this.element.src = url;
    },

    get url(){
        return urlInput.val()
    },

    get opacity(){
        return +opacInput.val()
    },
    set opacity(val){
        opacInput.val(val);
    }
}