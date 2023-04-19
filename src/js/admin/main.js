// TODO add protected pixels support

import '../../css/waiter.css'
import '../../img/sha.jpg'
import '../../../node_modules/toastr/build/toastr.css'

import querystring from 'querystring'
import { rgb2uint32 } from '../convert/color'
import { ROLE } from '../../../../goroxels-server/src/constants'

let canvases;

async function apiRequest(path, args, isPost = false, isBinary = false) {
    // this is shit
    const query = querystring.stringify(args)

    const resp = await fetch('/api/' + path + '?' + query, {
        method: isPost ? 'POST' : 'GET'
    });

    if(resp.headers.get('Content-Type').startsWith('plain/binary') || isBinary){
        return await resp.arrayBuffer();
    }
    const json = await resp.json();

    if (json.errors) {
        json.errors.forEach(e => toastr.error(e));
        return null
    }

    return json
}

// returns cancelAnimation callback
function addWaiter(container){
    const el = 
    $(`<div class="waitContainer" style="opacity: 0">
        <div class="waitElement">
            <div class="waitShape"></div>
            <div class="waitShape"></div>
            <div class="waitShape"></div>
            <div class="waitShape"></div>
        </div>
    </div>`);

    const rect = container.getBoundingClientRect();

    $(container).append(el);

    el.css('top', rect.top)
        .css('left', rect.left)
        .css('width', rect.width)
        .css('height', rect.height);
    
    setTimeout(() => {
        el.css('opacity', 1);
    })

    return () => {
        el.remove();
    }
}

function parseBackupResponse(respAB){
    const respUI8 = new Uint8Array(respAB);

    let curChar, currentOffset = 0;
    while(curChar !== 0){
        curChar = respUI8[currentOffset++];
        if(currentOffset > 0xffff){
            throw new Error('Metadata length is too long, aborting');
        }
    }

    const metadataText = new TextDecoder().decode(respUI8.subarray(0, currentOffset-1));

    const metadata = JSON.parse(metadataText);

    const chunkLength = metadata.chunkSize**2;

    const chunks = {};
    for (let cx = 0; cx < metadata.width; cx++) {
        for (let cy = 0; cy < metadata.height; cy++) {
            const key = `${cx},${cy}`;
            const localOffset = chunkLength*(cx+cy*metadata.width)
            const offset = currentOffset+localOffset;
            chunks[key] = respUI8.subarray(offset, offset+chunkLength);
        }
    }

    return {
        metadata, chunks
    }
}

async function initBackup() {
    function getCropVals(){
        if (!$("#cropCB").is(':checked')) {
            $('#cropXStart,#cropYStart,#cropXEnd,#cropYEnd').removeAttr('placeholder');
            return null
        };

        let cropXstart = $('#cropXStart').val();
        let cropYstart = $('#cropYStart').val();
        let cropXend = $('#cropXEnd').val();
        let cropYend = $('#cropYEnd').val();

        if(!cropXstart.length){
            cropXstart = 0;
            $('#cropXStart').attr('placeholder', cropXstart);
        }
        if(!cropYstart.length){
            cropYstart = 0;
            $('#cropYStart').attr('placeholder', cropYstart);
        }

        if(!cropXend.length){
            cropXend = cropXstart
            $('#cropXEnd').attr('placeholder', cropXend);
        }
        if(!cropYend.length){
            cropYend = cropYstart
            $('#cropYEnd').attr('placeholder', cropYend);
        }

        cropXstart = +cropXstart;
        cropXend = +cropXend;
        cropYstart = +cropYstart;
        cropYend = +cropYend;

        if (cropXstart < 0 || cropXstart > cropXend ||
            cropYstart < 0 || cropYstart > cropYend) {
            return null
        }

        return {
            cropXstart, cropXend, 
            cropYstart, cropYend
        }
    }
    async function updateDays(canvas) {
        let days = await apiRequest('admin/backup/getDays', { canvas });
        if (!days) return false;

        days = sortDates(days);

        $('#dateSelect option').remove();

        for (let day of days) {
            const el = `<option>${day}</option>`;
            $('#dateSelect').append(el);
        }

        $('#dateSelect option:last-child').attr('selected', true);

        return days
    }

    async function updateTimes(canvas, day) {
        const times = await apiRequest('admin/backup/getTimes', { canvas, day })
        if (!times) return false;

        $('#timeSelect option').remove();

        for (let time of times) {
            const el = `<option value="${time}">${time.replace(/-/g, ':')}</option>`;
            $('#timeSelect').append(el);
        }

        $('#timeSelect option:last-child').attr('selected', true);

        return times
    }

    let lastData = {};
    async function updateBackup(canvas, day, time, forceUpdate) {
        // TODO cache rendered and uncompressed canvas instead?
        let waiterCB = null;
        if (forceUpdate) {
            const canvasCont = $('#bkCanvasWrapper')[0]
            if(canvasCont)
                waiterCB = addWaiter(canvasCont);

            let resp = await apiRequest('admin/backup/getBackup', { canvas, day, time }, false, true);
            if(!resp) return;

            lastData = parseBackupResponse(resp);           
        }

        const timer = Date.now();
        renderBackup(lastData.chunks, lastData.metadata, getCurrentChunkCrop(), isUseGrid());
        console.log('renderBackup in ' + (Date.now() - timer));
        createZoomView($('#bkCanvasWrapper>canvas')[0]);

        if(waiterCB){
            waiterCB();
        }
    }

    function renderBackup(chunks, metadata, crop, useGrid) {
        const chunkSize = metadata.chunkSize;

        let width = chunkSize * metadata.width,
            height = chunkSize * metadata.height;

        let offX = 0,
            offY = 0;

        if (crop !== null) {
            crop.startX = Math.min(metadata.width, crop.startX);
            crop.startY = Math.min(metadata.height, crop.startY);
            crop.endX = Math.min(metadata.width, crop.endX);
            crop.endY = Math.min(metadata.height, crop.endY);

            offX = -(crop.startX * chunkSize);
            offY = -(crop.startY * chunkSize);

            width = ((crop.endX + 1) - crop.startX) * chunkSize;
            height = ((crop.endY + 1) - crop.startY) * chunkSize;
        }

        const encodedPal = metadata.palette.map(x => rgb2uint32(x));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const u32a = new Uint32Array(imgData.data.buffer);

        Object.keys(chunks).forEach(chunkId => {
            const [cx, cy] = chunkId.split(',').map(x => +x);
            if (crop !== null) {
                if (cx < crop.startX || cx > crop.endX ||
                    cy < crop.startY || cy > crop.endY) {
                    return
                }
            }

            let rawData = chunks[chunkId];

            let color, i = 0, j, preY;

            const startX = cx * chunkSize + offX,
                endX = startX + chunkSize;
            const startY = cy * chunkSize + offY,
                endY = startY + chunkSize;

            for (let y = startY; y < endY; y++) {
                preY = y * width
                for (let x = startX; x < endX; x++) {
                    if(x < 3 && y == 0){
                        console.log({
                            x, y,
                            rdn: rawData[i] & 0x7F,
                            rd: rawData[i]
                        })
                    }
                    color = encodedPal[rawData[i++] & 0x7F];
                    j = x + preY;

                    u32a[j] = color;
                }
            }
        })

        ctx.putImageData(imgData, 0, 0);

        if (useGrid) {
            ctx.beginPath();

            ctx.strokeStyle = 'red';
            ctx.lineWidth = 3;
            ctx.setLineDash([ctx.lineWidth / 0.75, ctx.lineWidth / 0.66666]);

            for (let y = chunkSize; y < height - 1; y += chunkSize) {
                ctx.moveTo(0, y);
                ctx.lineTo(width - 1, y);
            }
            for (let x = chunkSize; x < width - 1; x += chunkSize) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height - 1);
            }

            ctx.stroke();
            ctx.closePath();

            ctx.setLineDash([]);

            const halfChunk = chunkSize / 2,
                fontHei = chunkSize / 4;
            ctx.font = fontHei + 'px sans-serif';
            ctx.fillStyle = 'red'
            ctx.strokeStyle = 'white';

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = fontHei / 6;

            let text,
                offx = 0, offy = 0;
            if (crop) {
                offx = crop.startX || 0;
                offy = crop.startY || 0;
            }

            const cw = canvas.width / chunkSize,
                ch = canvas.height / chunkSize;
            for (let cy = 0; cy < ch; cy++) {
                for (let cx = 0; cx < cw; cx++) {
                    text = `(${cx + offx}, ${cy + offy})`;

                    let x = (cx * chunkSize) + halfChunk,
                        y = (cy * chunkSize) + halfChunk;

                    ctx.strokeText(text, x, y);
                    ctx.fillText(text, x, y);
                }
            }
        }

        $('#backupContainer *').remove();
        $('#backupContainer').append($('<div id="bkCanvasWrapper">'));
        $('#bkCanvasWrapper').append(canvas);

        // убрать
        $('body').scrollTop(999);
    }

    function getCurrentCanvas() {
        return $('#buCanvasSelect').val()
    }

    function getCurrentDay() {
        return $('#dateSelect').val()
    }

    function getCurrentTime() {
        return $('#timeSelect').val()
    }

    function isUseGrid() {
        return $('#gridCB').is(':checked')
    }

    function getCurrentChunkCrop() {
        if (!$("#cropCB").is(':checked')) return null;

        const vals = getCropVals();
        if(!vals){
            return null;
        }

        const {
            cropXstart, cropXend, 
            cropYstart, cropYend
        } = vals;


        return {
            startX: cropXstart,
            startY: cropYstart,
            endX: cropXend,
            endY: cropYend
        }
    }

    async function initialRequest() {
        await onCanvasUpdated();
    }

    function onSomethingChanged(forceUpdate) {
        const curCanvas = getCurrentCanvas();
        const curDay = getCurrentDay();
        const curTime = getCurrentTime();

        if ([curCanvas, curDay, curTime].some(x => x == "")) {
            return
        }

        updateBackup(curCanvas, curDay, curTime, forceUpdate);
    }

    async function onCanvasUpdated() {
        const canvas = getCurrentCanvas();

        const days = await updateDays(canvas),
            day = days[days.length - 1];
        const times = await updateTimes(canvas, day),
            time = times[times.length - 1]

        await updateBackup(canvas, day, time, true);
    }

    $('#gridCB, #cropCB, #timeSelect, .cropInput').on('change', e => {
        if (e.className == 'cropInput' && !$("#cropCB").is(':checked')) return;
        onSomethingChanged(e.target.id === 'timeSelect');
    });

    // just to add and remove "disabled" attr from/to rollback checkbock
    $('#cropCB').on('change', () => {
        const enabled = $("#cropCB").is(':checked');
        if (enabled)
            $('#cropRollbackCB').removeAttr('disabled');
        else
            $('#cropRollbackCB').attr('disabled', '');
    })

    $('#buCanvasSelect').on('change', onCanvasUpdated);
    $('#dateSelect').on('change', async () => {
        await updateTimes(getCurrentCanvas(), getCurrentDay());
        onSomethingChanged(true);
    });

    function sortDates(dates) {
        return dates.sort((a, b) => {
            return dateToInt(a) - dateToInt(b)
        });
    }

    function dateToInt(date) {
        const [
            day,
            month,
            year
        ] = date.split('.').map(x => parseInt(x, 10));

        let int = 0;

        int += year * 365;
        int += month * 31;
        int += day;

        return int
    }

    $('#rollback').on('click', async () => {
        const canvas = getCurrentCanvas();
        const day = getCurrentDay();
        const time = getCurrentTime();
        const crop = getCurrentChunkCrop();

        if ([canvas, day, time].some(x => x == "")) {
            return
        }

        const cropEnabled = crop && $("#cropRollbackCB").is(':checked');

        // let p = prompt('Are you sure?');
        // if(p == null) return;

        const resp = await apiRequest('/admin/backup/rollback', {
            canvas, day, time,
            crop: cropEnabled ? [crop.startX, crop.startY, crop.endX, crop.endY].join(',') : ''
        }, true);
        const json = await resp.json();
        if (json.success) toastr.success('Rollbacked!');
        else toastr.error(json.errors);
    })

    initialRequest().catch(e => {
        console.error(e);
        toastr.error(e);
    });
}

function initIP() {
    $('#sendIps').on('click', async () => {
        const act = $('input[name="ipAction"]:checked').val();
        let ips = $('#ips').val();

        ips = ips.split('\n');

        if (ips.length == 0) {
            toastr.error('All ips are invalid');
            return
        }

        const resp = await fetch('/api/admin/ip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ips, action: act })
        });
        const json = await resp.json();

        for (let error of json.errors)
            toastr.error(error);

        if (json.success) toastr.success('Success');
        else toastr.error('Bad luck');
    })
}
function initOther() {
    $('#sendCaptchaEnabled').on('click', async () => {
        const state = $('#captchaState')[0].checked;

        const resp = await fetch('/api/admin/config/captchaState', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ state })
        })

        const json = await resp.json();
        if (json.success) {
            toastr.success('Success');
        } else {
            toastr.error('Failed');
            console.log(json);
        }
    });

    $('#sendJoinDelay').on('click', async () => {
        const value = $('#joinDelay').val();
        if (!value) return;

        const parsed = parseInt(value, 10);
        if (parsed < 0 || isNaN(parsed)) return;

        const resp = await fetch('/api/admin/config/afterJoinDelay', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: parsed })
        })

        const json = await resp.json();
        if (json.success) {
            toastr.success('Success');
        } else {
            toastr.error('Failed');
            console.log(json);
        }
    });

    initApplyMask();
}
function initApplyMask(){
    const fileInp = $('#protectMaskFile');
    let lastFile;
    fileInp.on('change', e => {
        if(fileInp[0].files.length){
            const file = fileInp[0].files[0];
            lastFile = file;
            $('label[for=protectMaskFile]').text(file.name);
        }else{
            $('label[for=protectMaskFile]').text('Choose image');
        }
    })

    $('#submitProtectMask').on('click', async () => {
        if(!lastFile) return;

        const x = +$('#protectMaskXOff').val();
        const y = +$('#protectMaskYOff').val();

        if([x,y].some(n => {
            return (isNaN(n) || n < 0)
        })) return;

        const canvas = $('#pmCanvasSelect').val();

        const fd = new FormData();
        fd.append('x', x);
        fd.append('y', y);
        fd.append('canvas', canvas);
        fd.append('img', lastFile);

        const resp = await fetch('/api/admin/canvas/applyProtectMask', {
            method: 'POST',
            body: fd
        });
        const respJson = await resp.json();
        respJson?.errors?.forEach(e => toastr.error(e));
    })
}

function initCanvasActions() {
    canvases.forEach((canv, id) => {
        $('#selectActCanvas').append(`<option value="${id}">${canv.name}</option>`);
    })

    $('#canvasAction').on('change', () => {
        const act = $('#canvasAction').val();
        // hide all (if will be more in future)
        $('.hidden.enlargeConfig').addClass('hidden');
        // and then show one
        if (act === 'enlarge') {
            $('.hidden.enlargeConfig').removeClass('hidden');
        }
    })

    $('#doCanvasAction').on('click', async () => {
        const act = $('#canvasAction').val();
        if (!act) return;

        const canv = $('#selectActCanvas').val();
        if (!canv) return;

        if (act === 'wipe')
            await wipeCanvas(canv);
        if (act === 'enlarge') {
            const t = $('#enTop').val();
            const r = $('#enRight').val();
            const b = $('#enBot').val();
            const l = $('#enLeft').val();

            if ([t, r, b, l].some(x => x > 254))
                return toastr.error('Max canvas size is 255!');
            if ([t, r, b, l].some(x => x < 0))
                return toastr.error('ENLARGE only, one way road');

            await enlargeCanvas(canv, t, r, b, l);
        }
    })

    async function wipeCanvas(id) {
        await apiRequest('admin/canvas/wipe', {
            canvas: id
        }, true);
        toastr.success('Canvas ' + canvases[id].name + ' wiped!')
    }

    async function enlargeCanvas(id, t, r, b, l) {
        // TODO check for errors
        await apiRequest('admin/canvas/enlarge', {
            canvas: id,

            top: t,
            right: r,
            bottom: b,
            left: l
        }, true);
        toastr.success('Canvas ' + canvases[id].name + ' enlarged!')
    }
}

async function loadConfig() {
    const resp = await fetch('/config.json');
    return await resp.json();
}

/**
 * 
 * @param {HTMLCanvasElement} canvas 
 */
function createZoomView(canvas){
    const size = 200;
    const halfSize = size/2|0;

    $('#zoomedCanvasView').remove();

    const zoomedViewCanvas = document.createElement('canvas');
    zoomedViewCanvas.id = 'zoomedCanvasView';
    zoomedViewCanvas.width = zoomedViewCanvas.height = size;
    zoomedViewCanvas.style.cssText = 
    `border: 1px solid black; \nposition: absolute; \ndisplay: none`

    document.body.appendChild(zoomedViewCanvas);

    const ctx = zoomedViewCanvas.getContext('2d');
    const origCtx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const canvasSizeDiffX = canvas.width/rect.width;
    const canvasSizeDiffY = canvas.height/rect.height;

    canvas.addEventListener('mousemove', e => {
        zoomedViewCanvas.style.display = ''

        const posX = Math.max(e.offsetX, 0);
        const posY = Math.max(e.offsetY, 0);

        const cordX = posX*canvasSizeDiffX;
        const cordY = posY*canvasSizeDiffY;

        const leftBound = cordX - halfSize;
        const topBound = cordY - halfSize;

        const rightBound = cordX + halfSize;
        const bottomBound = cordY + halfSize;

        render(leftBound, topBound, rightBound, bottomBound);

        zoomedViewCanvas.style.left = (e.clientX+10) + 'px';
        zoomedViewCanvas.style.top = (e.clientY+10) + 'px';
    });

    canvas.addEventListener('mouseleave', () => {
        zoomedViewCanvas.style.display = 'none';
    });


    function render(startX, startY, endX, endY){
        const imdata = origCtx.getImageData(startX, startY, endX-startX, endY-startY);
        ctx.putImageData(imdata, 0, 0);
    }
}

(async () => {
    let resp;
    try {
        resp = await fetch('/api/me');
    } catch (e) {
        toastr.error(e)
        return toastr.error('Error while fetching /api/me:')
    }
    const me = await resp.json();
    if (me.role < ROLE.MOD) {
        location.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        return
    }

    canvases = (await loadConfig()).canvases;

    switch (me.role) {
        case ROLE.ADMIN:
            $('.admin').show();
        case ROLE.MOD:
            $('.mod').show();
        default: {
            if (me.id == 1) {
                $('.superadmin').show();
            }
            break
        }
    }

    for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        $('.canvasSelect').append(
            `<option value="${i}" ${i === 0 ? 'selected' : ''}>${canvas.name}</option>`
        )
    }

    initBackup();
    initIP();
    initOther();
    initCanvasActions()
})()