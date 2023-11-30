export default class Pattern{
    constructor(url){
        this.url = url;
        this.loaded = false;

        this.canvas = null

        this._load()
    }

    _load(){
        const canvas = document.createElement('canvas');
        
        const img = new Image();
        img.src = this.url;

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;

            canvas.getContext('2d').drawImage(img, 0, 0);

            this.canvas = canvas;

            this.loaded = true;
            this.onload();
        }
    }

    createFilledCanvas(width, height, offsetX, offsetY){
        const ctx = this.canvas.getContext('2d');
        const pattern = ctx.createPattern(this.canvas, 'repeat');

        const filledCanvas = document.createElement('canvas');
        filledCanvas.width = width;
        filledCanvas.height = height;

        const filledCtx = filledCanvas.getContext('2d');
        
        filledCtx.fillStyle = pattern;
        
        // this "save restore" shit is copied from stackoverflow
        // it's needed to actually shift the pattern
        filledCtx.save();
        filledCtx.translate(offsetX, offsetY);
        filledCtx.fillRect(-offsetX, -offsetY, width, height);
        filledCtx.restore();

        return filledCanvas;
    }

    onload(){}
}