// TODO add protected pixels support

import '../../../node_modules/toastr/build/toastr.css'

import { canvases } from '../../../shared/config.json'
import querystring from 'querystring'
import { rgb2uint32 } from '../convert/color'
import pako from 'pako'

for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    $('#canvasSelect').append(
        `<option value="${i}" ${i === 0 ? 'selected' : ''}>${canvas.name}</option>`
    )
}

async function apiRequest(path, args) {
    const query = querystring.stringify(args)

    const resp = await fetch('/api/' + path + '?' + query);
    const json = await resp.json();

    if (json.errors) {
        json.errors.forEach(e => toastr.error(e));
        return null
    }

    return json
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
    if(forceUpdate){
        lastData = await apiRequest('admin/backup/getBackup', { canvas, day, time })
        if (!lastData) return false;
    }

    const timer = Date.now();
    renderBackup(lastData.chunks, lastData.metadata, getCurrentChunkCrop(), isUseGrid());
    console.log('renderBackup in ' + (Date.now() - timer));
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

    let rawData = new Uint8Array(chunkSize * chunkSize),
        encodedBuf;

    Object.keys(chunks).forEach(chunkId => {
        const [cx, cy] = chunkId.split(',').map(x => +x);
        if (crop !== null) {
            if (cx < crop.startX || cx > crop.endX ||
                cy < crop.startY || cy > crop.endY) {
                return
            }
        }

        let encodedData = chunks[chunkId];
        encodedData = atob(encodedData);
        encodedBuf = new Uint8Array(encodedData.length);

        for (let i = 0; i < encodedData.length; i++) {
            encodedBuf[i] = encodedData.charCodeAt(i);
        }

        rawData = pako.inflate(encodedBuf);

        let color, i = 0, j, prey;

        const startX = cx * chunkSize + offX,
            endX = startX + chunkSize;
        const startY = cy * chunkSize + offY,
            endY = startY + chunkSize;

        for (let y = startY; y < endY; y++) {
            prey = y * width
            for (let x = startX; x < endX; x++) {
                color = encodedPal[rawData[i++] & 0x7F];
                j = x + prey;

                u32a[j] = color;
            }
        }
    })

    ctx.putImageData(imgData, 0, 0);

    if (useGrid) {
        ctx.beginPath();        

        ctx.strokeStyle = 'red';
        ctx.lineWidth = width/133.3;
        ctx.setLineDash([ctx.lineWidth/0.75, ctx.lineWidth/0.66666]);

        for (let y = chunkSize; y < height - 1; y += chunkSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(width-1, y);
        }
        for (let x = chunkSize; x < width - 1; x += chunkSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height-1);
        }

        // добавлять ли цифры чанков?
        // TODO

        ctx.stroke();
        ctx.closePath();
    }

    $('#backupContainer *').remove();
    $('#backupContainer').append(canvas);
}

function getCurrentCanvas() {
    return $('#canvasSelect').val()
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

    let cropXstart = +$('#cropXStart').val() || 0;
    let cropYstart = +$('#cropYStart').val() || 0;
    let cropXend = +$('#cropXEnd').val() || 0;
    let cropYend = +$('#cropYEnd').val() || 0;

    if (cropXstart < 0 || cropXstart > cropXend ||
        cropYstart < 0 || cropYstart > cropYend) {
        return null
    }
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

function onSomethingChanged(forceUpdate){
    const curCanvas = getCurrentCanvas();
    const curDay = getCurrentDay();
    const curTime = getCurrentTime();

    if([curCanvas, curDay, curTime].some(x => x=="")){
        return
    }

    updateBackup(curCanvas, curDay, curTime, forceUpdate);
}

async function onCanvasUpdated(){
    const canvas = getCurrentCanvas();

    const days = await updateDays(canvas),
    day = days[days.length - 1];
    const times = await updateTimes(canvas, day),
        time = times[times.length - 1]

    await updateBackup(canvas, day, time, true);
}

$('#gridCB, #cropCB, #timeSelect').on('change', e => {
    onSomethingChanged(e.target.id === 'timeSelect');
});

$('#canvasSelect').on('change', onCanvasUpdated);
$('#dateSelect').on('change', () => {
    updateTimes(getCurrentCanvas(), getCurrentDay())
});

function sortDates(dates){
    return dates.sort((a, b) => {
        return dateToInt(a) - dateToInt(b)
    });
}

function dateToInt(date){
    const [
        day,
        month,
        year
    ] = date.split('.').map(x => parseInt(x, 10));

    let int = 0;

    int += year*365;
    int += month*31;
    int += day;

    return int
}

initialRequest().catch(e => {
    console.error(e);
    toastr.error(e);
})