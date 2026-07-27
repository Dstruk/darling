// Darling Editor - Motor "Clean-Canvas Proxy" V17
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput = document.getElementById('file-upload');
const wrapper = document.getElementById('canvas-wrapper');
const dropZone = document.getElementById('drop-zone');
const addTextBtn = document.getElementById('add-text-btn');
const exportBtn = document.getElementById('export-btn');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageDisplay = document.getElementById('page-num-display');

let pdfDoc = null;
let currentPage = 1;
let isRendering = false;

// --- 1. CARGA SEGURA ---
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
});

async function processFile(file) {
    try {
        dropZone.style.display = 'none';
        wrapper.innerHTML = '<div style="color:white; text-align:center; padding:50px;">Abriendo manual en modo de alto rendimiento...</div>';

        const arrayBuffer = await file.arrayBuffer();
        if (file.type === 'application/pdf') {
            pdfDoc = await pdfjsLib.getDocument({ 
                data: arrayBuffer,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
            }).promise;
            
            currentPage = 1;
            renderPage();
        } else {
            renderImagePage(file);
        }
    } catch (err) {
        console.error("V17 Error:", err);
        wrapper.innerHTML = '<div style="color:#ff4444; text-align:center; padding:50px;">Error de memoria. Prueba con un manual más corto o desde PC.</div>';
    }
}

async function renderPage() {
    if (!pdfDoc || isRendering) return;
    isRendering = true;
    wrapper.innerHTML = '';
    pageDisplay.innerText = `Pág: ${currentPage} / ${pdfDoc.numPages}`;

    const page = await pdfDoc.getPage(currentPage);
    // Escala moderada para PC y Móvil
    const isMobile = window.innerWidth < 768;
    const scale = isMobile ? 1.0 : 1.5;
    const viewport = page.getViewport({ scale });

    const container = document.createElement('div');
    container.className = 'page-container';
    container.style.width = `${viewport.width}px`;
    container.style.height = `${viewport.height}px`;
    container.style.margin = '0 auto';
    container.style.backgroundColor = 'white';
    container.style.position = 'relative';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Renderizado estándar (Estable)
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
        const h = item.height * scale;
        const w = item.width * scale;

        if (item.str.trim().length > 0) {
            const block = document.createElement('div');
            block.className = 'editable-block draggable';
            block.contentEditable = true;
            block.innerText = item.str;
            
            block.style.position = 'absolute';
            block.style.transform = `translate(${x}px, ${y - h}px)`;
            block.setAttribute('data-x', x);
            block.setAttribute('data-y', y - h);
            
            // LA CLAVE: Fondo sólido para tapar el dibujo original
            block.style.backgroundColor = 'white'; 
            block.style.fontSize = `${h}px`;
            block.style.color = 'black'; 
            block.style.minWidth = `${w + 2}px`;
            block.style.minHeight = `${h}px`;
            block.style.lineHeight = '1';
            
            textLayer.appendChild(block);
        }
    });

    container.appendChild(canvas);
    container.appendChild(textLayer);
    wrapper.appendChild(container);
    
    initInteractions();
    isRendering = false;
}

// Navegación
prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderPage(); } };
nextBtn.onclick = () => { if (pdfDoc && currentPage < pdfDoc.numPages) { currentPage++; renderPage(); } };

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

addTextBtn.onclick = () => {
    const layer = document.querySelector('.text-layer');
    if (layer) {
        const b = document.createElement('div');
        b.className = 'editable-block draggable';
        b.contentEditable = true;
        b.innerText = 'Nuevo Texto';
        b.style.transform = 'translate(100px, 100px)';
        b.setAttribute('data-x', 100);
        b.setAttribute('data-y', 100);
        b.style.fontSize = '20px';
        b.style.backgroundColor = 'white';
        layer.appendChild(b);
        b.focus();
    }
};

exportBtn.onclick = async () => {
    const pageContainer = document.querySelector('.page-container');
    if (!pageContainer) return;
    exportBtn.innerText = "Exportando...";
    const { jsPDF } = window.jspdf;
    const canvas = await html2canvas(pageContainer, { scale: 1.5, useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const doc = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    doc.save('Manual_Darling.pdf');
    exportBtn.innerText = "Exportar PDF";
};
