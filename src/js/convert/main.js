import '../../css/converters.css';

import '../../img/folder.png';
import '../../img/pattern.png';
import '../../img/palette.png';
import '../../img/palette2.png';
import palettes, { loadGamePalettes } from './palettes';

import './setImmediate';

const clrManip = require('./color');
const bayer = require('./bayerMatrices');
const importedPatterns = require('./patterns');

import imgZoom from './imgzoom';
import openImage from './openImage';

import { upload } from './imgur';

import { init, translate as t } from '../translate'
init();

// автоматический корректор инпута
$('input[type=number]').on('change', (e) => {
    let input = e.target;

    if (input.max) {
        input.value = Math.min(input.value, input.max);
    }

    if (input.min) {
        input.value = Math.max(input.value, input.min);
    }
})

let utils = {
    // технически, любой путь подойдёт
    isURLValid(url) {
        if (!url || !url.length) return false;

        try {
            new URL(url);
        } catch {
            return false;
        }

        return true
    },
    isURLImage(url) {
        return new RegExp('\.(png|jpg|gif)$').test(url);
    }
}

const paletteSel = $('#paletteSel');
function applyPalettes(selected='pixelplanet'){
    Object.keys(palettes).forEach(key => {
        const newEl = $(`<option id="p_${key}">${key}</option>`);
        newEl.val(key);

        if(key === selected)
            newEl.attr('selected', '');
    
        paletteSel.prepend(newEl);
    });
    paletteSel.append('<option value="_custom">custom</option>');
}

paletteSel.on('change', () => {
    const val = paletteSel.val();

    if (val === "_custom") {
        $('#userPalette').show();
    } else {
        $('#userPalette').hide();

        const pal = palettes[val];

        palUtils.setPalette(pal);
        palUtils.updatePalette();

        visualizePalette();

        converterPreload(false);
    }

    palUtils.usedColors = [];
    patUtils.usedColors = [];
});

$('#userPalette').attr('placeholder',
    '[[r, g, b],[r, g, b], ...] | ["#hex", "#hex", ...] | [[r, g, b], ["#hex"], ...]');
$('#userPalette').on('input', () => {
    tryParseUserPalette();
    visualizePalette();
});

function visualizePalette() {
    const pal = paletteRGB;

    $('#palette').children().remove();

    pal.forEach(col => {
        const el = $(`<div class="paletteCol" style="background-color:rgb(${col.join(',')})"></div>`);
        $('#palette').append(el);
    });
}


function tryParseUserPalette() {
    try {
        let tempPal = JSON.parse($('#userPalette').val())

        if (tempPal.length === 0)
            throw new Error('Null palette length')

        tempPal = tempPal.map(el => {
            if (typeof el === 'string') { // hex
                if (el.startsWith('#')) el = el.slice(1);

                return clrManip.hex2rgb(el);
            } else if (typeof el === 'object' && el.length === 3) { // rgb array
                return el
            }

            throw new Error('Unknown color type')
        })

        palUtils.setPalette(tempPal);
        palUtils.updatePalette();

        converterPreload(false);
    } catch (e) {
        $('#userPalette').css('background-color', 'rgb(249,141,141)');
        return
    }
    $('#userPalette').css('background-color', '')
}

let paletteRGB = palettes['game.main'],
    paletteLAB,
    palette32;

let palUtils = {
    link: null,
    converterInterval: null,
    usedColors: [],
    rgb2lab: clrManip.rgb2lab,
    rgb2uint32: clrManip.rgb2uint32,
    setPalette(palette) {
        paletteRGB = palette
    },
    updatePalette() {
        paletteLAB = paletteRGB.map(this.rgb2lab);
        palette32 = paletteRGB.map(this.rgb2uint32);

        this.ditherPalette();
    },
    ditherPalette() {
        // спи.. взято на вооружение!
        this.colorValuesExRGB = [];
        this.colorValuesExLab = [];
        const threshold = +$('#palThresold').val() * 1.2; // UI is presented as a range of 0..100, but ciede2000 maxes out at ~120.
        paletteRGB.forEach((col1, col1idx) => {
            paletteRGB.forEach((col2, col2idx) => {
                if (col2idx >= col1idx) {
                    if (clrManip.mciede2000(col1, col2) <= threshold) {
                        const mix = clrManip.mixColors(col1, col2);
                        const col1lab = paletteLAB[col1idx];
                        const col2lab = paletteLAB[col2idx];
                        if (col1lab[0] >= col2lab[0]) { // put lighter colors first regardless of combo
                            this.colorValuesExRGB.push([mix[0], mix[1], mix[2], col1idx, col2idx]);
                        } else {
                            this.colorValuesExRGB.push([mix[0], mix[1], mix[2], col2idx, col1idx]);
                        }
                    }
                }
            });
        });
        this.colorValuesExRGB.forEach((val, idx) => {
            this.colorValuesExLab[idx] = clrManip.rgb2lab(val);
            this.colorValuesExLab[idx][3] = val[3];
            this.colorValuesExLab[idx][4] = val[4];
        });
    },
    ditherTypes: {
        //      X   7
        //  3   5   1
        floydSteinberg: [
            [7 / 16, 1, 0],
            [3 / 16, -1, 1],
            [5 / 16, 0, 1],
            [1 / 16, 1, 1]
        ],
        //          X   8   4 
        //  2   4   8   4   2
        //  1   2   4   2   1
        stuki: [
            [8 / 42, 1, 0],
            [4 / 42, 2, 0],
            [2 / 42, -2, 1],
            [4 / 42, -1, 1],
            [8 / 42, 0, 1],
            [4 / 42, 1, 1],
            [2 / 42, 2, 1],
            [1 / 42, -2, 2],
            [2 / 42, -1, 2],
            [4 / 42, 0, 2],
            [2 / 42, 1, 2],
            [1 / 42, 2, 2],
        ],
        //          X   4   3
        //  1   2   3   2   1
        sierraTwo: [
            [4 / 16, 1, 0],
            [3 / 16, 2, 0],
            [1 / 16, -2, 1],
            [2 / 16, -1, 1],
            [3 / 16, 0, 1],
            [2 / 16, 1, 1],
            [1 / 16, 2, 1],
        ],
    },
    /**
     * 
     * @param {ImageData} imageData 
     * @param {String} dithering 
     */
    * errorDithering(imageData, dithering) {
        const width = imageData.width;
        const height = imageData.height;

        const serp = $('#serp')[0].checked;
        let imgData = imageData.data;

        let deFunction;
        let palette = paletteRGB;

        const buf32 = new Uint32Array(imgData.buffer);

        switch ($('#colorfunc').val()) {
            case 'lwrgbde':
                deFunction = clrManip.lwrgbde;
                break
            case 'ciede1994':
                deFunction = clrManip.mciede1994mix;
                palette = paletteLAB;
                break
            case 'ciede2000':
                deFunction = clrManip.mciede2000mix;
                palette = paletteLAB;
                break
            case 'cmcic':
                deFunction = clrManip.cmcicMix;
                palette = paletteLAB;
                break
            case 'eucl':
                deFunction = clrManip.euclidian;
                break
        }

        let cntr = 0;
        let dir = 1;

        for (let y = 0; y < height; y++) {
            for (let x = (dir > 0 ? 0 : width - 1), max = (dir > 0 ? width : 0); x !== max; x += dir) {
                const i = x + y * width;

                const col32 = buf32[i];

                if (col32 >> 24 !== 0) {
                    const color = clrManip.uint32toRGB(col32);
                    const rgb = col32 & 0xffffff;
                    // console.log(col32, color, buf32)

                    let matchIndex = -1;
                    const usedIndex = this.usedColors[rgb];
                    if (usedIndex !== undefined) {
                        matchIndex = usedIndex;
                    } else {
                        matchIndex = clrManip.mapcolor(color, palette, deFunction);
                        this.usedColors[rgb] = matchIndex;
                    }
                    const matchingColor32 = palette32[matchIndex],
                        matchingColor = paletteRGB[matchIndex];

                    buf32[i] = matchingColor32;

                    if (dithering) {
                        const distR = color[0] - matchingColor[0],
                            distG = color[1] - matchingColor[1],
                            distB = color[2] - matchingColor[2];

                        for (let j = (~dir ? 0 : dithering.length - 1), end = (~dir ? dithering.length : 0); j != end; j += dir) {
                            const p = dithering[j];

                            const [mult, X, Y] = [p[0], x + p[1] * dir, y + p[2]];
                            if (X < 0 || X >= width || Y < 0 || Y >= height)
                                continue;

                            const i = X + Y * width;
                            let rgb = clrManip.uint32toRGB(buf32[i]);

                            const I = i * 4;

                            imgData[I] = Math.max(0, Math.min(255, rgb[0] + distR * mult));
                            imgData[I + 1] = Math.max(0, Math.min(255, rgb[1] + distG * mult));
                            imgData[I + 2] = Math.max(0, Math.min(255, rgb[2] + distB * mult));
                        }
                    }
                } else {
                    buf32[i] = 0;
                }

                if (cntr++ % 2000 === 0) {
                    yield cntr / buf32.length;
                }
            }


            if (serp)
                dir *= -1;
        }

        return imageData;
    },
    * checkboardDithering(imageData) { // дупликация кода конечно, но мне пофег
        const width = imageData.width;
        let imgData = imageData.data;

        let deFunction;
        let palette = this.colorValuesExRGB;
        switch ($('#colorfunc').val()) {
            case 'lwrgbde':
                deFunction = clrManip.lwrgbde;
                break
            case 'ciede2000':
                deFunction = clrManip.mciede2000mix;
                palette = this.colorValuesExLab;
                break
            case 'cmcic':
                deFunction = clrManip.cmcicMix;
                palette = this.colorValuesExLab;
                break
            case 'eucl':
                deFunction = clrManip.euclidian;
                break
        }

        const rowSize = width * 4;
        // палитра со смешанными цветами
        // в зависимости от расположения, цвет будет чередоваться
        let cntr = 0;
        for (let i = imgData.length - 1; i >= 0; i -= 4) {
            if (imgData[i] > 0) {
                let color = [imgData[i - 3], imgData[i - 2], imgData[i - 1]];
                const colorEnc = (color[0] << 16) + (color[1] << 8) + color[2];
                let matchIndex = -1;
                const usedIndex = this.usedColors[colorEnc];
                if (usedIndex !== undefined) {
                    matchIndex = usedIndex;
                } else {
                    matchIndex = clrManip.mapcolor(color, palette, deFunction);
                    this.usedColors[colorEnc] = matchIndex;
                }
                const matchingColor1 = this.colorValuesExRGB[matchIndex][3];
                const matchingColor2 = this.colorValuesExRGB[matchIndex][4];

                // x + y % 2
                if (((i - 3) % rowSize / 4 + Math.floor(i / rowSize)) % 2 === 0) {
                    matchIndex = matchingColor1;
                } else {
                    matchIndex = matchingColor2;
                }

                const matchingColor = paletteRGB[matchIndex];

                imgData[i - 3] = matchingColor[0];
                imgData[i - 2] = matchingColor[1];
                imgData[i - 1] = matchingColor[2];
            } else {
                imgData[i - 3] = 0;
                imgData[i - 2] = 0;
                imgData[i - 1] = 0;
                imgData[i] = 0;
            }

            if (cntr++ % 2000 === 0) {
                yield cntr / (imgData.length / 4);
            }
        }
        return imageData;
    },
    * orderedDithering(imageData, matrixSize, custom = false, mode = 1) {
        const M = bayer[custom ? ('c' + matrixSize) : matrixSize];

        // matrix maximum value
        const max = M.length ** 2;

        const width = imageData.width;
        let imgData = imageData.data;

        let deFunction;
        let palette = paletteRGB;
        switch ($('#colorfunc').val()) {
            case 'lwrgbde':
                deFunction = clrManip.lwrgbde;
                break
            case 'ciede2000':
                deFunction = clrManip.mciede2000mix;
                palette = paletteLAB;
                break
            case 'cmcic':
                deFunction = clrManip.cmcicMix;
                palette = paletteLAB;
                break
            case 'eucl':
                deFunction = clrManip.euclidian;
                break
        }

        let cntr = 0;
        for (let i = 0; i < imgData.length; i += 4) {
            if (imgData[i + 3] > 0) {
                let origOffset = i / 4;
                let x = origOffset % width;
                let y = origOffset / width | 0; // отбрасывает числа после запятой
                let matrixThres = M[x % matrixSize][y % matrixSize];
                if (mode === 0) {
                    matrixThres = -matrixThres;
                } else if (mode == 2) {
                    matrixThres -= max / 2;
                }

                for (let j = 0; j < 3; j++) {
                    imgData[i + j] += matrixThres;
                } // цикл по rgb

                let color = [imgData[i], imgData[i + 1], imgData[i + 2]];

                const colorEnc = (color[0] << 16) + (color[1] << 8) + color[2];
                let matchIndex = -1;
                const usedIndex = this.usedColors[colorEnc];
                if (usedIndex !== undefined) {
                    matchIndex = usedIndex;
                } else {
                    matchIndex = clrManip.mapcolor(color, palette, deFunction);
                    //toastr.info(error);
                    this.usedColors[colorEnc] = matchIndex;
                }
                const matchingColor = paletteRGB[matchIndex];
                imgData[i] = matchingColor[0];
                imgData[i + 1] = matchingColor[1];
                imgData[i + 2] = matchingColor[2];
            } else {
                imgData[i - 3] = 0;
                imgData[i - 2] = 0;
                imgData[i - 1] = 0;
                imgData[i] = 0;
            }
            if (cntr++ % 2000 === 0) {
                yield cntr / (imgData.length / 4);
            }
        }
        return imageData;
    }
}

$('#palFolder').on('click', () => {
    openImage(dataURL => {
        $('#palInput').val(t('[clipboard]'));
        $('#palInput').data('source', 'dataURL');

        palUtils.dataURL = dataURL;

        converterPreload();
    })
})

$('#palGOBtn').on('click', () => {
    converterPreload();
});

$('#palInput').on('keydown', (e) => {
    $('#palInput')[0].dataset.source = "url";
    if (e.keyCode === 13) {
        converterPreload();
    }
});

$('#ditheringMode').on('change', () => {
    let val = $('#ditheringMode').val();

    if (val === 'ordered') {
        $('#ordMatrix').removeClass('hidden');
    } else {
        $('#ordMatrix').addClass('hidden');
    }

    if (val === 'check') {
        $('#thresoldDiv').removeClass('hidden');
    } else {
        $('#thresoldDiv').addClass('hidden');
    }

    // serpentine mode is only works for error dithering
    if (['f-s', 'stuki', 'sierra', 'sierra-lite'].includes(val)) {
        $('#serpBlock').removeClass('hidden');
    } else {
        $('#serpBlock').addClass('hidden');
    }
});

$('#palInput').on('paste', (e) => {
    let files = e.originalEvent.clipboardData.items;
    let images = [];
    for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image')) {
            images.push(files[i].getAsFile());
        };
    }
    if (!images.length) return;
    e.preventDefault();

    let image = images[0];

    const reader = new FileReader();
    reader.onload = function (ev) {
        $('#palInput').val(t('[clipboard]'));
        $('#palInput').data('source', 'dataURL');
        const tempImage = new Image();
        tempImage.onload = function () {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = tempImage.width;
            tempCanvas.height = tempImage.height;
            const clipCtx = tempCanvas.getContext("2d");
            clipCtx.drawImage(tempImage, 0, 0);
            palUtils.dataURL = tempCanvas.toDataURL("image/png");
            converterPreload();
        };
        tempImage.src = ev.target.result;
    };
    reader.readAsDataURL(image);
})

function converterPreload(showWarn = true) {
    let path = $('#palInput').val();
    if ($('#palInput').data('source') !== 'dataURL') {
        if (!path.length) {
            return showWarn && toastr.error(t('Choose a image!'));
        }

        if (utils.isURLValid(path)) {
            palUtils.link = path;
            startPaletteConverter(path);
        } else {
            return showWarn && toastr.error(t('Invalid link!'));
        }
    } else {
        startPaletteConverter(palUtils.dataURL);
    }
}

function startPaletteConverter(url) {
    clearImmediate(palUtils.converterInterval);

    let tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.src = url;

    tempImg.onload = () => {
        let canvas = document.createElement('canvas');
        canvas.width = tempImg.width;
        canvas.height = tempImg.height;

        let ctx = canvas.getContext('2d');
        ctx.drawImage(tempImg, 0, 0);
        tempImg = null;

        try {
            var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
            return toastr.error(t('Image is loaded, but pixels can not be shown. Try to load it on Imgur or download->upload from file'))
        }

        const contrast = +$('#colorAdj').val();
        const brightness = +$('#brightAdj').val();
        imgData = clrManip.adjustGamma(imgData, contrast, brightness)

        let convGen; // converterGenerator
        switch ($('#ditheringMode').val()) {
            case 'none':
                convGen = palUtils.errorDithering(imgData);
                break;
            case 'f-s':
                convGen = palUtils.errorDithering(imgData, palUtils.ditherTypes.floydSteinberg);
                //convGen = palUtils.floydSteinberg(imgData, palUtils.ditherTypes.floydSteinberg);
                break;
            case 'stuki':
                convGen = palUtils.errorDithering(imgData, palUtils.ditherTypes.stuki);
                break;
            case 'check':
                convGen = palUtils.checkboardDithering(imgData);
                break;
            case 'sierra':
                convGen = palUtils.errorDithering(imgData, palUtils.ditherTypes.sierraTwo);
                break;
            case 'sierra-lite':
                convGen = palUtils.errorDithering(imgData, palUtils.ditherTypes.sierraLite);
                break;
            case 'ordered':
                var matrix = $('#ordMatrixSelect').val();
                var mode = $('#ordMatrixModeSelect').val();

                if (mode == 'des') mode = 0;
                else if (mode == 'asc') mode = 1;
                else mode = 2;

                var custom = false;
                if (matrix.startsWith('c')) {
                    custom = true;
                    matrix = matrix.slice(1);
                }
                convGen = palUtils.orderedDithering(imgData, +matrix, custom, mode);
                break;
            default:
                toastr.warning('O_o');
                return;
        }

        palUtils.usedColors = [];

        let startTime = Date.now();
        const progressBar = $('#palLB>.barProgress');
        progressBar.parent().parent().removeClass('hidden');
        palUtils.converterInterval = setImmediate(function rec() {
            let loaded = convGen.next();

            if (loaded.done) {
                progressBar.parent().parent().addClass('hidden');
                progressBar.css('width', 0);
                ctx.putImageData(imgData, 0, 0);
                onDone(canvas, 'palOut',
                    () => {
                        toastr.info(`${t('Done in')} ${(Date.now() - startTime) / 1000} ${s}`);
                    });
            } else {
                let perc = loaded.value*100;
                if(perc > 97) perc = 100;
                progressBar.css('width', perc + '%');
                palUtils.converterInterval = setImmediate(rec);
            }
        });
    }

    tempImg.onerror = () => {
        toastr.error('Unknown image loading error. Maybe CORS, so try to upload on Imgur')
    }
}

$('#palThresold').on('change', () => {
    palUtils.ditherPalette();
    converterPreload();
});
$('#colorAdj').on('input', (e) => {
    $('#colorAdjLabel').text(e.target.value);
});
$('#resetContrast').on('click', () => {
    $('#colorAdj').val(0);
    $('#colorAdjLabel').text(0);
});

$('#brightAdj').on('input', (e) => {
    $('#brightAdjLabel').text(e.target.value);
});
$('#resetBrightness').click(() => {
    $('#brightAdj').val(0);
    $('#brightAdjLabel').text(0);
});
document.onkeydown = e => {
    if (e.key === 'Enter' && !e.repeat) {
        converterPreload();
    }
}

// -----------------------------------------------
// -----------------------------------------------
// -----------------------------------------------
// -----------------------------------------------
// -----------------------------------------------

let patUtils = {
    patterns: importedPatterns.patterns,
    defaultPattern: importedPatterns.defaultPattern,
    patternSize: Math.sqrt(importedPatterns.patterns[0].length),

    usedColors: [],

    patternsCans: [], // список картинок с паттернами для ускоренного рисования
    generatePatterns() {
        this.patternsCans = [];
        const patternSize = this.patternSize;
        let pattern, ctx, color;
        for (let i = 0; i < paletteRGB.length; i++) {
            let canvas = document.createElement('canvas');
            canvas.width = canvas.height = patternSize;

            pattern = this.patterns[i % this.patterns.length];
            color = paletteRGB[i];

            ctx = canvas.getContext('2d');

            ctx.fillStyle = `rgb(${color.join(',')})`;

            for (let j = 0; j < pattern.length; j++) {
                if (!pattern[j]) continue;

                const x = j % patternSize,
                    y = j / patternSize | 0;

                ctx.fillRect(x, y, 1, 1);
            }

            this.patternsCans.push(canvas);
        }
    },
    drawPattern(ctx, pattern, startX, startY, color){
        let s = this.patternSize;
        ctx.fillStyle = `rgb(${color.join(',')})`;
        for(let x = 0; x < s; x++){
            for(let y = 0; y < s; y++){
                if(!pattern[x+y*s]) continue
                ctx.fillRect(startX+x, startY+y, 1, 1);
            }
        }
    },
    // todo расширяемые паттерны
    * patternize(canvas) {
        const ctx = canvas.getContext('2d');
        const {
            data: imgData,
            width, height
        } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        this.generatePatterns();

        const patternSize = this.patternSize;
        const patternLength = patternSize ** 2;

        const newWidth = width * patternSize;
        const newHeight = height * patternSize;

        let newCanvas = document.createElement('canvas');
        newCanvas.width = newWidth;
        newCanvas.height = newHeight;

        const ctx2 = newCanvas.getContext('2d');

        // actual palette32 includes opacity, i don't need it
        let palette32 = paletteRGB.map(c => (c[0] << 16) + (c[1] << 8) + c[2])
        let colorMap = new Map();
        palette32.forEach((el, i) => colorMap.set(el, i))

        let imgX, imgY, absX, absY, color, colId, color32, _i, pattern;
        for (let i = 0; i < imgData.length; i += 4) {
            if (imgData[i + 3] < 127) continue;

            _i = i / 4;
            imgX = _i % width;
            imgY = _i / width | 0;

            absX = imgX * patternSize;
            absY = imgY * patternSize;

            color = [imgData[i], imgData[i + 1], imgData[i + 2], imgData[i + 3]];
            color32 = (color[0] << 16) + (color[1] << 8) + color[2];

            colId = colorMap.get(color32);

            pattern = this.patternsCans[colId];

            if (pattern) {
                ctx2.drawImage(pattern, absX, absY);
            }else{
                this.drawPattern(ctx2, this.defaultPattern, absX, absY, color)
            }

            if (i % 8000 === 0) {
                yield i / imgData.length
            }
        }
        //newCanvas.getContext('2d').putImageData(newImgData, 0, 0);

        return newCanvas;
    }
}

$('#patFolder').on('click', () => {
    openImage(dataURL => {
        $('#patInput').val(t('[clipboard]'));
        $('#patInput').data('source', 'dataURL');

        patUtils.dataURL = dataURL;

        patternPreload();
    })
})

$('#patGOBtn').on('click', () => {
    patternPreload();
});

$('#patInput').on('keydown', (e) => {
    $('#patInput').data('source', 'url');
    if (e.keyCode === 13) {
        patternPreload();
    }
});

$('#patInput').on('paste', (e) => {
    let files = e.originalEvent.clipboardData.items;
    let images = [];
    for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image')) {
            images.push(files[i].getAsFile());
        };
    }
    if (!images.length) return;
    e.preventDefault();

    let image = images[0];

    const reader = new FileReader();
    reader.onload = function (ev) {
        $('#patInput').val(t('[clipboard]'));
        $('#patInput').data('source', 'dataURL');

        const tempImage = new Image();
        tempImage.onload = function () {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = tempImage.width;
            tempCanvas.height = tempImage.height;
            const clipCtx = tempCanvas.getContext("2d");
            clipCtx.drawImage(tempImage, 0, 0);
            patUtils.dataURL = tempCanvas.toDataURL("image/png");
            patternPreload();
        };
        tempImage.src = ev.target.result;
    };
    reader.readAsDataURL(image);
})

function patternPreload() {
    let path = $('#patInput').val();
    if ($('#patInput').data('source') !== 'dataURL') {
        if (!path.length) {
            return toastr.error(t('Choose a image!'));
        }

        if (utils.isURLValid(path) && utils.isURLImage(path)) {
            palUtils.link = path;
            patternatorStart(path);
        } else {
            return toastr.error(t('Invalid link!'));
        }
    } else {
        patternatorStart(patUtils.dataURL);
    }
}

function patternatorStart(url) {
    clearImmediate(patUtils.converterInterval);

    let tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.src = url;

    tempImg.onload = () => {
        let canvas = document.createElement('canvas');
        canvas.width = tempImg.width;
        canvas.height = tempImg.height;

        if (canvas.width > 800 || canvas.height > 800) {
            //toastr.warning('Image is wider than 800px, this can crash the page');
        }

        let ctx = canvas.getContext('2d');
        ctx.drawImage(tempImg, 0, 0);

        try {
            ctx.getImageData(0, 0, 1, 1);
        } catch (e) {
            return toastr.error(t('Image is loaded, but pixels can not be gotten. Try to load it on Imgur or download->upload from file'))
        }

        toastr.warning(t('If your image is big, go make a tea and watch Doctor Who'));
        let convGen = patUtils.patternize(canvas);

        let startTime = Date.now();
        patUtils.converterInterval = setImmediate(function rec() {
            let loaded = convGen.next();

            if (loaded.done) {
                onDone(loaded.value, 'patOut',
                    () => {
                        toastr.info(`${t('Done in')} ${(Date.now() - startTime) / 1000}s.`);
                    });
            } else {
                patUtils.converterInterval = setImmediate(rec);
            }
        });
    }

    tempImg.onerror = () => {
        toastr.error(t('Unknown image loading error. Maybe CORS, so try to upload on Imgur'))
    }
}

function createImgData(width, height) {
    let tempCanvas = document.createElement('canvas');

    let newImgData = tempCanvas.getContext('2d').createImageData(width, height);
    tempCanvas = null;

    return newImgData
}

async function onDone(canvas, convClass, callback) {
    $(`#${convClass} > *`).remove();

    canvas.className = 'outputImg';

    const zoomChecked = $('#autoZoom')[0].checked;

    let newImg = document.createElement('img');
    newImg.className = 'outputImg' + (zoomChecked ? ' zoomed' : '');
    newImg.src = canvas.toDataURL();
    if (!zoomChecked) newImg.style.width = Math.min(canvas.width, parseInt($(`#${convClass}`).css('width')) / 2) + 'px';

    $(`#${convClass}`)[0].appendChild(newImg);

    $(`#${convClass}`).append(
        `<div class="afterImage">
            <div class="line"><button class="uploadButton"> ${t('Upload on imgur!')} </button></div>
            <div class="line"><span class="imgurUrl"></span></div>
            ${convClass === 'patOut' ? `<div class="line">${t('Final image size:')} ${canvas.width}x${canvas.height}</div>` : ''}
        </div>`
    );
    imgZoom.createZoomHandler($(`#${convClass}`).children(0)[0]);

    $(`#${convClass} .uploadButton`).on('click', async () => {
        $(`#${convClass} .uploadButton`).off('click');
        $(`#${convClass} .imgurUrl`).text('Uploading...');

        try {
            const link = await upload(canvas.toDataURL().split(",")[1]);
            const isPNG = link.endsWith('png');
            $(`#${convClass} .imgurUrl`).html(
                `<span style="color:${isPNG ? 'rgb(0, 190, 0)' : 'rgb(249, 141, 141)'}">${link}${convClass === 'patOut' ? `?width=${canvas.width / 7}` : ''}</span>`
            )
        } catch {
            const text = t('Imgur upload failed, try upload manually and add this to a link:') +
                (convClass == 'patOut' ? ` "?width=${canvas.width / 7}"` : '');

            $(`#${convClass} .imgurUrl`).text(text)
        }
    });

    callback();
}

let palName;
loadGamePalettes().then(() => {
    palName = 'game.main'
}).catch(() => {
    toastr.error(t('Failed to load game palettes!'));
    palName = 'pixelplanet'
}).finally(() => {
    applyPalettes(palName);
    paletteRGB = palettes[palName];

    palUtils.updatePalette();
    visualizePalette();
});