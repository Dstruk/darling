// Darling Editor - Motor Ultra-Fiel con Filtrado de Operadores
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput = document.getElementById('file-upload');
const wrapper = document.getElementById('canvas-wrapper');
const dropZone = document.getElementById('drop-zone');
const toggleBgBtn = document.getElementById('toggle-bg');
const addTextBtn = document.getElementById('add-text-btn');
const exportBtn = document.getElementById('export-btn');

// --- 1. PROCESAMIENTO PROFESIONAL ---

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
});

async function processFile(file) {
    try {
        dropZone.style.display = 'none';
        wrapper.innerHTML = '<div class="loading">Procesando documento...</div>'; 

        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            wrapper.innerHTML = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                await renderCleanPage(page);
            }
        } else if (file.type.startsWith('image/')) {
            await renderImagePage(file);
        }
        initInteractions();
    } catch (err) {
        console.error("Error cargando archivo:", err);
        wrapper.innerHTML = '<div class="error">Error al cargar el archivo. Intenta con uno más ligero.</div>';
    }
}

async function renderCleanPage(page) {
    // Ajuste de escala para Móvil vs Desktop para evitar "pantalla en blanco"
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const scale = isMobile ? 1.0 : 1.5; 
    const viewport = page.getViewport({ scale });
    
    const pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;

    // --- MAGIA PARA ELIMINAR FANTASMAS ---
    const opList = await page.getOperatorList();
    
    // Filtramos los operadores de dibujo: eliminamos showText y glifos (efecto MASON/SwingSet)
    const filteredOps = new pdfjsLib.OperatorList();
    const textOps = [
        pdfjsLib.OPS.showText,
        pdfjsLib.OPS.showTextGlyphs,
        pdfjsLib.OPS.nextLineShowText,
        pdfjsLib.OPS.showSpacedText,
        pdfjsLib.OPS.nextLineSetSpacingShowText
    ];

    for (let i = 0; i < opList.fnArray.length; i++) {
        if (!textOps.includes(opList.fnArray[i])) {
            filteredOps.addOp(opList.fnArray[i], opList.argsArray[i]);
        }
    }

    // Renderizamos el fondo LIMPIO (sin letras) usando SVG
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
    const svg = await svgGfx.getSVG(filteredOps, viewport);
    pageContainer.appendChild(svg);

    // Capa de Edición (Gemelo Digital)
    const textLayer = document.createElement('div');
    textLayer.className = 'text-layer';
    const textContent = await page.getTextContent();
    
    textContent.items.forEach(item => {
        const tx = pdfjsLib.Util.transform(
            pdfjsLib.Util.transform(viewport.transform, item.transform),
            [1, 0, 0, -1, 0, 0]
        );
        createEditableBlock(textLayer, item.str, tx[4], tx[5] - (item.height * 0.8), item.height * scale, item.fontName);
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
                const width = Math.min(window.innerWidth - 40, 800);
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

function createEditableBlock(container, text, x, y, size, font = 'sans-serif') {
    const block = document.createElement('div');
    block.className = 'editable-block draggable';
    block.contentEditable = true;
    block.innerText = text;
    block.style.transform = `translate(${x}px, ${y}px)`;
    block.setAttribute('data-x', x);
    block.setAttribute('data-y', y);
    block.style.fontSize = `${size}px`;
    block.style.fontFamily = font;
    container.appendChild(block);
    return block;
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

// Toolbar
toggleBgBtn.addEventListener('click', () => {
    const svgs = document.querySelectorAll('svg');
    svgs.forEach(s => s.style.visibility = s.style.visibility === 'hidden' ? 'visible' : 'hidden');
});

addTextBtn.addEventListener('click', () => {
    const layer = document.querySelector('.text-layer');
    if(layer) createEditableBlock(layer, 'Nuevo Texto', 50, 50, 20).focus();
});

exportBtn.addEventListener('click', async () => {
    exportBtn.innerText = "Exportando...";
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const pages = document.querySelectorAll('.page-container');
    for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2 });
        if (i > 0) doc.addPage();
        doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 595, 842);
    }
    doc.save('Darling_WordLike.pdf');
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
