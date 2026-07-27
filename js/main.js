// Darling Editor - Motor "Clean Slate" V10
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
        wrapper.innerHTML = '<div style="color:white; text-align:center; padding:50px; font-family:sans-serif;">Abriendo en modo edición directa...</div>';

        const arrayBuffer = await file.arrayBuffer();
        if (file.type === 'application/pdf') {
            const pdf = await pdfjsLib.getDocument({ 
                data: arrayBuffer,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
            }).promise;
            
            wrapper.innerHTML = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                await renderCleanSlatePage(page);
            }
        } else {
            await renderImagePage(file);
        }
        initInteractions();
    } catch (err) {
        console.error("Error:", err);
        wrapper.innerHTML = '<div style="color:#ff4444; text-align:center; padding:50px;">Error al cargar. El archivo es muy complejo o pesado.</div>';
    }
}

async function renderCleanSlatePage(page) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const scale = isMobile ? 1.0 : 1.5; 
    const viewport = page.getViewport({ scale });
    
    const pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;
    pageContainer.style.position = 'relative';
    pageContainer.style.backgroundColor = 'white';

    // 1. FONDO LIMPIO (Sin texto original)
    // Extraemos la lista de operadores y eliminamos los de texto
    const opList = await page.getOperatorList();
    const filteredOps = new pdfjsLib.OperatorList();
    const textOps = [
        pdfjsLib.OPS.beginText,
        pdfjsLib.OPS.endText,
        pdfjsLib.OPS.showText,
        pdfjsLib.OPS.showTextGlyphs,
        pdfjsLib.OPS.showSpacedText,
        pdfjsLib.OPS.nextLineShowText
    ];

    for (let i = 0; i < opList.fnArray.length; i++) {
        if (!textOps.includes(opList.fnArray[i])) {
            filteredOps.addOp(opList.fnArray[i], opList.argsArray[i]);
        }
    }

    // Renderizamos el fondo como SVG (más estable para transparencia)
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
    const svg = await svgGfx.getSVG(filteredOps, viewport);
    svg.style.width = '100%';
    svg.style.height = '100%';
    pageContainer.appendChild(svg);

    // 2. CAPA DE EDICIÓN (Texto real)
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
        const h = item.height * scale;
        const w = item.width * scale;

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
        block.style.lineHeight = '1';
        block.style.minWidth = `${w}px`;
        
        textLayer.appendChild(block);
    });

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
        layer.appendChild(b);
        b.focus();
    }
});

exportBtn.addEventListener('click', async () => {
    exportBtn.innerText = "Guardando...";
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const pages = document.querySelectorAll('.page-container');
    
    for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 1.5, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        if (i > 0) doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, 0, 595, 842);
    }
    doc.save('Darling_WordLike_V10.pdf');
    exportBtn.innerText = "Exportar Edición (PDF)";
});

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
});
