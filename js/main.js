// Darling Editor - Motor Lógico Profesional (Versión Limpia)
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput = document.getElementById('file-upload');
const wrapper = document.getElementById('canvas-wrapper');
const dropZone = document.getElementById('drop-zone');
const toggleBgBtn = document.getElementById('toggle-bg');
const addTextBtn = document.getElementById('add-text-btn');
const exportBtn = document.getElementById('export-btn');

let isBgVisible = true;
let selectedBlock = null;

// --- 1. GESTIÓN DE ARCHIVOS ---

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
            await renderPDFPage(page);
        }
    } else if (file.type.startsWith('image/')) {
        await renderImagePage(file);
    }
    
    initInteractions();
}

async function renderPDFPage(page) {
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    const pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;

    // Capa de Fondo
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Renderizado inicial del PDF
    await page.render({ canvasContext: context, viewport }).promise;

    const textLayer = document.createElement('div');
    textLayer.className = 'text-layer';
    
    const textContent = await page.getTextContent();
    
    // TÉCNICA DE LIMPIEZA: "Blanqueamos" el texto original en el canvas para evitar el efecto doble
    context.fillStyle = 'white'; // Asumimos fondo blanco, mejorable con detección de color
    
    textContent.items.forEach(item => {
        const tx = pdfjsLib.Util.transform(
            pdfjsLib.Util.transform(viewport.transform, item.transform),
            [1, 0, 0, -1, 0, 0]
        );

        const x = tx[4];
        const y = tx[5] - (item.height * 0.8);
        const fontSize = item.height * scale;

        // 1. Borrar el texto del canvas (el "original" visual)
        // Dibujamos un rectángulo blanco encima del texto en el canvas
        context.fillRect(x - 2, y - fontSize + 2, item.width * scale + 4, fontSize + 2);

        // 2. Crear el bloque editable (la "nueva realidad")
        createEditableBlock(textLayer, item.str, x, y, fontSize, item.fontName);
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
                const maxWidth = 800;
                const scale = Math.min(1, maxWidth / img.width);
                const width = img.width * scale;
                const height = img.height * scale;

                const pageContainer = document.createElement('div');
                pageContainer.className = 'page-container';
                pageContainer.style.width = `${width}px`;
                pageContainer.style.height = `${height}px`;

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                pageContainer.appendChild(canvas);

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

// --- 2. MOTOR DE EDICIÓN ---

function createEditableBlock(container, text, x, y, size, font = 'sans-serif') {
    const block = document.createElement('div');
    block.className = 'editable-block draggable';
    block.contentEditable = true;
    block.innerText = text;
    
    // Aseguramos que el texto sea visible y tenga fondo para tapar imperfecciones
    block.style.background = 'white'; 
    block.style.color = '#000000'; // Color por defecto para evitar el "blanco invisible"
    block.style.transform = `translate(${x}px, ${y}px)`;
    block.setAttribute('data-x', x);
    block.setAttribute('data-y', y);
    
    block.style.fontSize = `${size}px`;
    block.style.fontFamily = font;

    block.addEventListener('focus', () => selectedBlock = block);
    container.appendChild(block);
    return block;
}

// --- 3. INTERACCIONES ---

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

// --- 4. ACCIONES ---

toggleBgBtn.addEventListener('click', () => {
    isBgVisible = !isBgVisible;
    document.querySelectorAll('canvas').forEach(c => c.style.opacity = isBgVisible ? '1' : '0');
    toggleBgBtn.innerText = isBgVisible ? 'Ocultar Original' : 'Mostrar Original';
});

addTextBtn.addEventListener('click', () => {
    const layers = document.querySelectorAll('.text-layer');
    const activeLayer = layers[layers.length - 1];
    if (activeLayer) {
        const newBlock = createEditableBlock(activeLayer, 'Nuevo Texto', 100, 100, 20);
        newBlock.focus();
    }
});

exportBtn.addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const pages = document.querySelectorAll('.page-container');

    for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        if (i > 0) doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }
    doc.save('Darling_Editado.pdf');
});

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
});
