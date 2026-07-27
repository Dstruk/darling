// Darling Editor - Motor SVG de Alta Fidelidad
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput = document.getElementById('file-upload');
const wrapper = document.getElementById('canvas-wrapper');
const dropZone = document.getElementById('drop-zone');
const toggleBgBtn = document.getElementById('toggle-bg');
const addTextBtn = document.getElementById('add-text-btn');
const exportBtn = document.getElementById('export-btn');

// --- 1. PROCESAMIENTO DE ARCHIVOS ---

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
});

async function processFile(file) {
    dropZone.style.display = 'none';
    wrapper.innerHTML = ''; 

    if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            await renderSVGPage(page);
        }
    } else if (file.type.startsWith('image/')) {
        await renderImagePage(file);
    }
    initInteractions();
}

async function renderSVGPage(page) {
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    const pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;

    // Capa SVG: Renderizamos el PDF como vectores, no como imagen
    const opList = await page.getOperatorList();
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
    const svg = await svgGfx.getSVG(opList, viewport);
    
    // TRUCO EXPERTO: Ocultamos el texto original dentro del SVG sin borrar el fondo
    // Buscamos todos los elementos de texto del PDF y los hacemos invisibles
    const textElements = svg.querySelectorAll('text, tspan');
    textElements.forEach(el => el.style.opacity = '0');
    
    pageContainer.appendChild(svg);

    // Capa de Edición HTML (Nuestra capa interactiva)
    const textLayer = document.createElement('div');
    textLayer.className = 'text-layer';
    
    const textContent = await page.getTextContent();
    textContent.items.forEach(item => {
        const tx = pdfjsLib.Util.transform(
            pdfjsLib.Util.transform(viewport.transform, item.transform),
            [1, 0, 0, -1, 0, 0]
        );
        
        // Creamos el bloque editable exactamente sobre el texto oculto
        createEditableBlock(textLayer, item.str, tx[4], tx[5] - (item.height * 0.8), item.height * scale, item.fontName);
    });

    pageContainer.appendChild(textLayer);
    wrapper.appendChild(pageContainer);
}

async function renderImagePage(file) {
    // Para imágenes usamos el canvas como fondo sin blanquear
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const width = 800;
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
    
    // Fondo transparente para que no parezca un parche
    block.style.background = 'transparent'; 
    block.style.color = 'inherit'; // Intenta heredar el color del PDF
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

// Acciones Toolbar e Exportación actualizadas
toggleBgBtn.addEventListener('click', () => {
    const svgs = document.querySelectorAll('svg');
    svgs.forEach(s => s.style.display = s.style.display === 'none' ? 'block' : 'none');
});

addTextBtn.addEventListener('click', () => {
    const layer = document.querySelector('.text-layer');
    if(layer) createEditableBlock(layer, 'Nuevo Texto', 100, 100, 20).focus();
});

exportBtn.addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const pages = document.querySelectorAll('.page-container');
    for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2 });
        if (i > 0) doc.addPage();
        doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 595, 842);
    }
    doc.save('Darling_WordLike.pdf');
});
