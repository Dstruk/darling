// Darling Editor - Motor Lógico Profesional
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput = document.getElementById('file-upload');
const wrapper = document.getElementById('canvas-wrapper');
const dropZone = document.getElementById('drop-zone');
const toggleBgBtn = document.getElementById('toggle-bg');
const addTextBtn = document.getElementById('add-text-btn');
const exportBtn = document.getElementById('export-btn');
const propPanel = document.getElementById('properties-panel');

let isBgVisible = true;
let selectedBlock = null;

// --- 1. GESTIÓN DE ARCHIVOS ---

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
});

async function processFile(file) {
    dropZone.style.display = 'none';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    wrapper.innerHTML = ''; 

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        await renderPage(page);
    }
    initInteractions();
}

async function renderPage(page) {
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    const pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;

    // Capa de Fondo (El PDF original inalterado)
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    pageContainer.appendChild(canvas);

    // Capa de Edición (El "Gemelo Digital")
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

// --- 2. MOTOR DE EDICIÓN ---

function createEditableBlock(container, text, x, y, size, font = 'sans-serif') {
    const block = document.createElement('div');
    block.className = 'editable-block draggable';
    block.contentEditable = true;
    block.innerText = text;
    
    block.style.left = '0';
    block.style.top = '0';
    block.style.transform = `translate(${x}px, ${y}px)`;
    block.setAttribute('data-x', x);
    block.setAttribute('data-y', y);
    
    block.style.fontSize = `${size}px`;
    block.style.fontFamily = font;

    block.addEventListener('focus', () => selectBlock(block));
    container.appendChild(block);
    return block;
}

function selectBlock(block) {
    selectedBlock = block;
    // Mostrar panel de propiedades cerca del bloque
    const rect = block.getBoundingClientRect();
    // (Lógica simplificada para el panel)
}

// --- 3. INTERACCIONES (Interact.js) ---

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
        },
        modifiers: [
            interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true })
        ]
    });
}

// --- 4. ACCIONES DE LA TOOLBAR ---

toggleBgBtn.addEventListener('click', () => {
    isBgVisible = !isBgVisible;
    document.querySelectorAll('canvas').forEach(c => c.style.opacity = isBgVisible ? '1' : '0');
    toggleBgBtn.innerText = isBgVisible ? 'Ocultar Original' : 'Mostrar Original';
});

addTextBtn.addEventListener('click', () => {
    const firstPage = document.querySelector('.text-layer');
    if (firstPage) {
        const newBlock = createEditableBlock(firstPage, 'Nuevo Texto', 50, 50, 16);
        newBlock.focus();
    }
});

exportBtn.addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const pages = document.querySelectorAll('.page-container');

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        // Capturamos la vista actual (incluyendo nuestras ediciones)
        const canvas = await html2canvas(page, {
            scale: 2,
            useCORS: true,
            logging: false
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        if (i > 0) doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }

    doc.save('Darling_Editado.pdf');
});

// Drag & Drop UX
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
});
