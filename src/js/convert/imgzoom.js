// Нагло спизжено у pxlsfiddle
// Модифицировано
const imgZoom = {
    dlg: null,
    canvas: null,
    scaleLabel: null,
    customLabel: null,
  
    scales: [2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 24, 28, 32], // empirically determined; originally 17 was 16, but a simple polynomial of n=3 fit showed that value was an outlier. So is 8, but by half, and scaling non-integer? no thanks.
    scaleIndex: 2, // scale = 4
  
    src: null,
  
    // get the mouse position relative to an image based on its original size
    getImgMousePos(element, e) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const paddingRect = {
        left: parseInt(style.paddingLeft, 10),
        right: parseInt(style.paddingRight, 10),
        top: parseInt(style.paddingTop, 10),
        bottom: parseInt(style.paddingBottom, 10)
      };
  
      return {
        x: (e.clientX - rect.left - paddingRect.left) / (rect.width - (paddingRect.left + paddingRect.right)) * element.naturalWidth,
        y: (e.clientY - rect.top - paddingRect.top) / (rect.height - (paddingRect.top + paddingRect.bottom)) * element.naturalHeight
      };
    },
  
    // sets up event handlers for a given image element to pop up the zoom window
    createZoomHandler(el, cb) {
      el.onmouseenter = function () {
        imgZoom.src = el;
        const scale = imgZoom.scales[imgZoom.scaleIndex];
        imgZoom.scaleLabel.textContent = `${el.width}x${el.height}px; pixel zoom x${scale}`;
        imgZoom.canvas.width = el.naturalWidth;
        imgZoom.canvas.height = el.naturalHeight;
        imgZoom.canvas.getContext("2d").drawImage(el, 0, 0);
        imgZoom.dlg.style.display = "block";
      };
      el.onmouseleave = function () {
        imgZoom.src = null;
        imgZoom.customLabel.style.display = "none";
        imgZoom.dlg.style.display = "none";
      };
      el.onmousemove = function (e) {
        const scale = imgZoom.scales[imgZoom.scaleIndex];
  
        const mousePos = imgZoom.getImgMousePos(el, e);
        imgZoom.canvas.style.transform = `scale(${scale})`;
        imgZoom.canvas.style.left = `${imgZoom.dlg.offsetWidth / 2 - mousePos.x * scale - scale / 2}px`;
        imgZoom.canvas.style.top = `${imgZoom.dlg.offsetHeight / 2 - mousePos.y * scale - scale / 2}px`;
  
        if (typeof cb !== "undefined") {
          cb(el, mousePos, scale);
  
          return true;
        }
  
        return true;
      };
      el.onwheel = function (e) {
        if (e.altKey) {
          if (e.deltaY < 0) {
            imgZoom.scaleIndex = Math.min(imgZoom.scaleIndex + 1, imgZoom.scales.length - 1);
          } else if (e.deltaY > 0) {
            imgZoom.scaleIndex = Math.max(imgZoom.scaleIndex - 1, 0);
          }
          if (e.deltaY !== 0) {
            const scale = imgZoom.scales[imgZoom.scaleIndex];
            imgZoom.scaleLabel.textContent = `pixel zoom x${scale}`;
            el.onmousemove(e);
          }
          e.preventDefault();
        }
      };
      el.onclick = () => {
        if (!$(el).hasClass('zoomed')) {
          $(el).addClass('zoomed');
          $(el).css('width', '');
        } else {
          $(el).removeClass('zoomed');
          $(el).css('width', Math.min(parseInt($(el).parent().css('width')) / 2, $(el)[0].width));
          console.log($(el).parent().css('width'), $(el).parent(), 2)
        }
      }
    },
    refresh() {
      // imgZoom.canvas.width = imgZoom.src.width;
      // imgZoom.canvas.height = imgZoom.src.height;
      if (typeof imgZoom.src.naturalWidth !== "undefined") {
        imgZoom.canvas.width = imgZoom.src.naturalWidth;
        imgZoom.canvas.height = imgZoom.src.naturalHeight;
      } else {
        imgZoom.canvas.width = imgZoom.src.width;
        imgZoom.canvas.height = imgZoom.src.height;
      }
      imgZoom.canvas.getContext("2d").drawImage(imgZoom.src, 0, 0);
    },
    init() {
      const tmp = document.createElement("template");
      tmp.innerHTML = `<div id="_imgZoom" style="z-index:1555; background-color:rgba(0,0,0,0); position:fixed; top:0; right:0; border-width:0 0 2px 2px; border-style:solid; border-color:#000; border-radius:0 0 0 5px; padding:0 2px; text-align:right; pointer-events:none; display:none; width:50vw; height:50vh; overflow:hidden;"><canvas id="_imgZoomCanvas" style="position:absolute; image-rendering:-moz-crisp-edges; image-rendering:pixelated; transform-origin:0 0; transform:scale(4);"></canvas><strong id="_imgZoomLevel" style="background-color:#404040; border-radius:5px 0 0 0; padding:2px; position:absolute; bottom:0; right:0;">pixel zoom x4</strong><strong id="_imgZoomLabel" style="background-color:#404040; border-radius:0 5px 0 0; padding:2px; position:absolute; bottom:0; left:0; max-width:300px"></strong><div id="_imgZoomCrosshair" style="opacity:0.25;"><div style="background-color:#000; width:2px; height:20px; position:absolute; top:calc(50% - 10px); left:calc(50% - 1px);"></div><div style="background-color:#000; height:2px; width:20px; position:absolute; top:calc(50% - 1px); left:calc(50% - 10px);"></div></div></div>`;
      this.dlg = tmp.content.firstChild;
      document.body.appendChild(this.dlg);
      this.canvas = document.getElementById("_imgZoomCanvas");
      this.scaleLabel = document.getElementById("_imgZoomLevel");
      this.customLabel = document.getElementById("_imgZoomLabel");
  
      // zoom handlers for pixel images
      const pixelImages = document.querySelectorAll(".zoom");
      for (const imgElement of pixelImages) {
        this.createZoomHandler(imgElement);
      }
  
      // zoom handlers for future pixel images
      function cb(mutations) {
        for (const mut of mutations) {
          for (const addedNode of mut.addedNodes) {
            if (addedNode.querySelectorAll) {
              const zoomElements = addedNode.querySelectorAll("img.zoom");
              for (const el of zoomElements) {
                imgZoom.createZoomHandler(el);
              }
            }
          }
        }
      };
      const observer = new MutationObserver(cb);
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  };
  imgZoom.init();

  module.exports = imgZoom