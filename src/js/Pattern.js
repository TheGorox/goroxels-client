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

    onload(){}
}