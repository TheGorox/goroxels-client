import '../../css/converters.css';

import '../../img/folder.png';
import '../../img/pattern.png';
import '../../img/palette.png';
import palettes from './palettes';

const clrManip = require('./color');
const bayer = require('./bayerMatrices');
const importedPatterns = require('./patterns');

import imgZoom from './imgzoom';
import openImage from './openImage';

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

Object.keys(palettes).forEach(key => {
    const newEl = $(`<option>${key}</option>`);
    newEl.val(key);

    if (key === 'game.main') newEl.attr('selected', '');

    paletteSel.prepend(newEl);
});
paletteSel.append('<option value="_custom">custom</option>');

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

function visualizePalette(){
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

                            const [mult, X, Y] = [p[0], x + p[1]*dir, y + p[2]];
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
        $('#palInput').val('[буфер обмена]');
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
    if(['f-s', 'stuki', 'sierra', 'sierra-lite'].includes(val)){
        $('#serpBlock').removeClass('hidden');
    }else{
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
        $('#palInput').val('[буфер обмена]');
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
            return showWarn && toastr.error('Укажи изображение!');
        }

        if (utils.isURLValid(path)) {
            palUtils.link = path;
            startPaletteConverter(path);
        } else {
            return showWarn && toastr.error('Ссылка невалидная!');
        }
    } else {
        startPaletteConverter(palUtils.dataURL);
    }
}

function startPaletteConverter(url) {
    // иногда вызывает ошибку. наверное потому, что он уже очищен из памяти сборщиком
    // а может я просто долбоёб. лень разбираться
    try {
        clearTimeout(palUtils.converterInterval);
    } catch {}

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
            return toastr.error('Изображение загружено, но не хочет показывать себя. Скорее всего, виноват CORS. Рекомендую скачать эту картинку и повторить попытку через файл. Ну или ты просто дурачок.', 'ОШИБКА ЗАГРУЗКИ ИЗОБРАЖЕНИЯ')
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
        palUtils.converterInterval = setTimeout(function rec() {
            let loaded = convGen.next();

            if (loaded.done) {
                //ctx.putImageData(loaded.value, 0, 0);
                ctx.putImageData(imgData, 0, 0);
                onDone(canvas, 'palOut',
                    () => {
                        toastr.info(`Завершено за ${(Date.now() - startTime)/1000}сек.`);
                    });
            } else {
                palUtils.converterInterval = setTimeout(rec);
            }
        });
    }

    tempImg.onerror = () => {
        toastr.error('Предыдущие проверки пройдены, так что скорее всего либо файла нет, либо cors(хотя не должОн)', 'ОШИБКА ЗАГРУЗКИ ИЗОБРАЖЕНИЯ')
    }
}

palUtils.updatePalette();

$('#palThresold').on('change', () => {
    palUtils.ditherPalette();
    converterPreload();
});
$('#colorAdj').on('input', (e) => {
    $('#colorAdjLabel').text(e.target.value);
});
$('#resetContrast').click(() => {
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
    if(e.code === 'Enter' && !e.repeat){
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
    usedColors: [],
    // todo расширяемые паттерны
    * patternize(canvas) {
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const width = imgData.width;
        const height = imgData.height;

        const imgDataData = imgData.data;

        const patternSize = Math.sqrt(this.patterns[0].length);
        const patternLength = patternSize ** 2;

        const newWidth = width * patternSize;
        const newHeight = height * patternSize;

        let newCanvas = document.createElement('canvas');
        newCanvas.width = newWidth;
        newCanvas.height = newHeight;

        const ctx2 = newCanvas.getContext('2d');

        for (let i = 0; i < imgDataData.length; i += 4) {
            let _i = i / 4;
            const imgX = _i % width;
            const imgY = _i / width | 0;

            if (imgDataData[i + 3] < 127) continue;

            const absX = imgX * patternSize;
            const absY = imgY * patternSize;

            const color = [imgDataData[i], imgDataData[i + 1], imgDataData[i + 2], imgDataData[i + 3]];
            const colorEnc = (color[0] << 16) + (color[1] << 8) + color[2];
            let colId = -1;
            const usedIndex = this.usedColors[colorEnc];
            if (usedIndex !== undefined) {
                colId = usedIndex;
            } else {
                colId = clrManip.getColorIndex(color, paletteRGB);
                this.usedColors[colorEnc] = colId;
            }

            const pattern = colId > -1 ? this.patterns[colId % this.patterns.length] : this.defaultPattern;

            ctx2.fillStyle = `rgb(${color.join(',')})`;

            for (let j = 0; j < patternLength; j++) {
                let bool = pattern[j];
                if (!bool) continue;

                let _x = j % patternSize;
                let _y = j / patternSize | 0;

                let _absX = absX + _x;
                let _absY = absY + _y;

                ctx2.fillRect(_absX, _absY, 1, 1);
            }

            if (i % 8000 === 0) {
                yield i / imgDataData.length
            }
        }
        //newCanvas.getContext('2d').putImageData(newImgData, 0, 0);

        return newCanvas;
    }
}

$('#patFolder').on('click', () => {
    openImage(dataURL => {
        $('#patInput').val('[буфер обмена]');
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
        $('#patInput').val('[буфер обмена]');
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
            return toastr.error('Укажи изображение!');
        }

        if (utils.isURLValid(path) && utils.isURLImage(path)) {
            palUtils.link = path;
            patternatorStart(path);
        } else {
            return toastr.error('Ссылка невалидная!');
        }
    } else {
        patternatorStart(patUtils.dataURL);
    }
}

function patternatorStart(url) {
    //clearInterval(palUtils.converterInterval);
    // иногда вызывает ошибку. наверное потому, что он уже очищен из памяти сборщиком
    try {
        clearTimeout(patUtils.converterInterval);
    } catch (e) {
        console.log(e);
    }

    let tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.src = url;

    tempImg.onload = () => {
        let canvas = document.createElement('canvas');
        canvas.width = tempImg.width;
        canvas.height = tempImg.height;

        if (canvas.width > 800 || canvas.height > 800) {
            toastr.warning('Изображение больше 800 пикселей стороной, это может крашнуть темплейт.');
        }

        let ctx = canvas.getContext('2d');
        ctx.drawImage(tempImg, 0, 0);

        try {
            ctx.getImageData(0, 0, 1, 1);
        } catch (e) {
            return toastr.error('Изображение загружено, но не хочет показывать себя. Скорее всего, виноват CORS. Рекомендую скачать эту картинку и повторить попытку через файл.', 'ОШИБКА ЗАГРУЗКИ ИЗОБРАЖЕНИЯ')
        }

        toastr.warning('Если изображение большое, после конвертации темплейт может зависнуть на время. Наберись терпения.');
        let convGen = patUtils.patternize(canvas);

        let startTime = Date.now();
        patUtils.converterInterval = setTimeout(function rec() {
            let loaded = convGen.next();

            if (loaded.done) {
                onDone(loaded.value, 'patOut',
                    () => {
                        toastr.info(`Завершено за ${(Date.now() - startTime)/1000}сек.`);
                    });
            } else {
                patUtils.converterInterval = setTimeout(rec);
            }
        });
    }

    tempImg.onerror = () => {
        toastr.error('Предыдущие проверки пройдены, так что скорее всего либо файла нет, либо cors(хотя не должОн)', 'ОШИБКА ЗАГРУЗКИ ИЗОБРАЖЕНИЯ')
    }
}

function imgurUpload(base64, cb) {
    // todo
}

function createImgData(width, height) {
    let tempCanvas = document.createElement('canvas');

    let newImgData = tempCanvas.getContext('2d').createImageData(width, height);
    tempCanvas = null;

    return newImgData
}

function onDone(canvas, convClass, callback) {
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
            <div class="line">Imgur upload is not supported yet</div>
            ${convClass === 'patOut' ? `<div class="line">Итоговый размер картинки: ${canvas.width}x${canvas.height}</div>` : ''}
        </div>`
    );

    imgZoom.createZoomHandler($(`#${convClass}`).children(0)[0]);

    callback();
}

visualizePalette();