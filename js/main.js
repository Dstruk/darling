// Darling Editor - Motor "Ultra-Resilient" V11
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput = document.getElementById('file-upload');
const wrapper = document.getElementById('canvas-wrapper');
const dropZone = document.getElementById('drop-zone');
const addTextBtn = document.getElementById('add-text-btn');
const exportBtn = document.getElementById('export-btn');

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
});

async function processFile(file) {
    try {
        dropZone.style.display = 'none';
        wrapper.innerHTML = '<div style="color:white; text-align:center; padding:50px; font-family:sans-serif;">Analizando manual complejo... <br><small>Esto puede tardar unos segundos en dispositivos móviles</small></div>';

        const arrayBuffer = await file.arrayBuffer();
        if (file.type === 'application/pdf') {
            const pdf = await pdfjsLib.getDocument({ 
                data: arrayBuffer,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
            }).promise;
            
            wrapper.innerHTML = '';
            // Proceso secuencial para evitar saturación de memoria
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                await renderProPage(page);
                // Pequeño respiro para el procesador
                await new Promise(r => setTimeout(r, 150));
            }
        } else if (file.type.startsWith('image/')) {
            await renderImagePage(file);
        }
        initInteractions();
    } catch (err) {
        console.error("Error crítico:", err);
        wrapper.innerHTML = `<div style="color:#ff4444; text-align:center; padding:50px;">
            Error de memoria. <br>El archivo es demasiado complejo para procesarlo con filtros avanzados.<br>
            <button onclick="location.reload()" style="margin-top:10px; padding:10px; border-radius:5px; border:none; background:#2563eb; color:white; cursor:pointer;">Reintentar</button>
        </div>`;
    }
}

async function renderProPage(page) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // Escala adaptada para no colapsar la memoria RAM
    const scale = isMobile ? 0.9 : 1.5; 
    const viewport = page.getViewport({ scale });
    
    const pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;
    pageContainer.style.position = 'relative';
    pageContainer.style.backgroundColor = 'white';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // 1. Renderizar fondo original completo
    await page.render({ canvasContext: ctx, viewport }).promise;

    const textLayer = document.createElement('div');
    textLayer.className = 'text-layer';
    const textContent = await page.getTextContent();

    textContent.items.forEach(item => {
        const tx = pdfjsLib.Util.transform(
            pdfjsLib.Util.transform(viewport.transform, item.transform),
            [1, 0, 0, -1, 0, 0]
        );

        const x = tx[4];
        const y = tx[5];
        const w = item.width * scale;
        const h = item.height * scale;

        if (item.str.trim().length > 0) {
            // --- BORRADO QUIRÚRGICO DE ALTA PRECISIÓN ---
            // Muestreamos el color del fondo justo al lado del texto para camuflar el borrado
            let bgColor = 'white';
            try {
                // Muestra 2 píxeles a la izquierda y arriba del bloque
                const sampleX = x > 2 ? x - 2 : x + w + 2;
                const sampleY = y - h - 2;
                const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
                bgColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
            } catch(e) {
                bgColor = 'white';
            }

            // Pintamos un rectángulo del color del fondo sobre el original para eliminar el "fantasma"
            ctx.fillStyle = bgColor;
            // Damos un pequeño margen para asegurar el borrado total de glifos complejos
            ctx.fillRect(x - 2, y - h - 3, w + 4, h + 6);

            // --- BLOQUE EDITABLE (Capa superior) ---
            const block = document.createElement('div');
            block.className = 'editable-block draggable';
            block.contentEditable = true;
            block.innerText = item.str;
            
            block.style.position = 'absolute';
            block.style.transform = `translate(${x}px, ${y - h}px)`;
            block.setAttribute('data-x', x);
            block.setAttribute('data-y', y - h);
            
            block.style.fontSize = `${h}px`;
            block.style.color = 'black'; 
            block.style.backgroundColor = 'transparent'; 
            block.style.minWidth = `${w}px`;
            block.style.lineHeight = '1';
            
            textLayer.appendChild(block);
        }
    });

    pageContainer.appendChild(canvas);
    pageContainer.appendChild(textLayer);
    wrapper.appendChild(pageContainer);
}

async function renderImagePage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const width = Math.min(window.innerWidth - 20, 800);
                const scale = width / img.width;
                const height = img.height * scale;
                const pageContainer = document.createElement('div');
                pageContainer.className = 'page-container';
                pageContainer.style.width = `${width}px`;
                pageContainer.style.height = `${height}px`;
                pageContainer.style.backgroundImage = `url(${e.target.result})`;
                pageContainer.style.backgroundSize = 'contain';
                const textLayer = document.createElement('div');
                textLayer.className = 'text-layer';
                pageContainer.appendChild(textLayer);
                wrapper.appendChild(pageContainer);
                resolve();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function initInteractions() {
    interact('.draggable').draggable({
        listeners: {
            move(event) {
                const target = event.target;
                const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
                target.style.transform = `translate(${x}px, ${y}px)`;
                target.setAttribute('data-x', x);
                target.setAttribute('data-y', y);
            }
        }
    });
}

addTextBtn.addEventListener('click', () => {
    const layers = document.querySelectorAll('.text-layer');
    const layer = layers[layers.length - 1];
    if(layer) {
        const b = document.createElement('div');
        b.className = 'editable-block draggable';
        b.contentEditable = true;
        b.innerText = 'Nuevo Texto';
        b.style.transform = 'translate(100px, 100px)';
        b.setAttribute('data-x', 100);
        b.setAttribute('data-y', 100);
        b.style.fontSize = '20px';
        b.style.color = 'black';
        layer.appendChild(b);
        b.focus();
    }
});

exportBtn.addEventListener('click', async () => {
    exportBtn.innerText = "Exportando PDF...";
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const pages = document.querySelectorAll('.page-container');
    
    for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 1.5, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        if (i > 0) doc.addPage();
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }
    doc.save('Darling_Editado_V11.pdf');
    exportBtn.innerText = "Exportar Edición (PDF)";
});

// Drag & Drop
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
});
