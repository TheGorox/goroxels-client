// TODO add protected pixels support

import '../../../node_modules/toastr/build/toastr.css'

import querystring from 'querystring'
import { rgb2uint32 } from '../convert/color'
import pako from 'pako'
import { ROLE } from '../../../../goroxels-server/src/constants'

let canvases;

async function apiRequest(path, args, isPost = false) {
    const query = querystring.stringify(args)

    const resp = await fetch('/api/' + path + '?' + query, {
        method: isPost ? 'POST' : 'GET'
    });
    const json = await resp.json();

    if (json.errors) {
        json.errors.forEach(e => toastr.error(e));
        return null
    }

    return json
}

async function initBackup() {



    for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        $('#canvasSelect').append(
            `<option value="${i}" ${i === 0 ? 'selected' : ''}>${canvas.name}</option>`
        )
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
        if (forceUpdate) {
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

            let color, i = 0, j, preY;

            const startX = cx * chunkSize + offX,
                endX = startX + chunkSize;
            const startY = cy * chunkSize + offY,
                endY = startY + chunkSize;

            for (let y = startY; y < endY; y++) {
                preY = y * width
                for (let x = startX; x < endX; x++) {
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
            ctx.lineWidth = width / 133.3;
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
        $('#backupContainer').append(canvas);

        // убрать
        $('body').scrollTop(999);
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

    $('#canvasSelect').on('change', onCanvasUpdated);
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

    initBackup();
    initIP();
    initOther();
    initCanvasActions()
})()