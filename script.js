// --- BASE DE DATOS Y ARREGLOS ---
const diasDeLaSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// --- CONFIGURACIÓN DE IMÁGENES ---
// Modifica este número según la cantidad de imágenes que tengas en la carpeta "motivacion"
const TOTAL_IMAGENES_MOTIVACION = 8; 

let baseDeDatosLocal = JSON.parse(localStorage.getItem('gymSemanaDB')) || {};
let estadoDias = JSON.parse(localStorage.getItem('gymEstadoDias')) || {};
let totalEntrenamientos = parseInt(localStorage.getItem('gymTotalDias')) || 0;
let fallosHistoricos = JSON.parse(localStorage.getItem('gymFallos')) || {}; 
let pesosMaximos = JSON.parse(localStorage.getItem('gymPesosMaximos')) || {}; 
let historialGlobal = JSON.parse(localStorage.getItem('gymHistorialGlobal')) || []; 
let diaActivo = null;

// Caché del cronómetro para optimización de DOM
let domElementCrono = null;

// --- LÓGICA DE NOMBRE DE USUARIO ---
function cargarNombre() {
    let nombreGuardado = localStorage.getItem('gymUserName') || 'Maximiliano';
    document.getElementById('nombre-usuario').innerText = nombreGuardado;
    document.getElementById('titulo-perfil-nombre').innerText = nombreGuardado;
    document.getElementById('letra-avatar').innerText = nombreGuardado.charAt(0).toUpperCase();
}

function editarNombre() {
    let nombreActual = localStorage.getItem('gymUserName') || 'Maximiliano';
    let nuevoNombre = prompt("Ingresa el nombre del usuario:", nombreActual);
    
    if (nuevoNombre !== null && nuevoNombre.trim() !== "") {
        localStorage.setItem('gymUserName', nuevoNombre.trim());
        cargarNombre();
    }
}

// --- LÓGICA DE WHATSAPP ---
function avisarBro(event) {
    event.stopPropagation();
    window.open("https://chat.whatsapp.com/GPtrTGFtMhk8icwQlcMbfw", '_blank');
}

// --- LÓGICA DEL CRONÓMETRO ---
let startTime, elapsedTime = 0, timerInterval, isRunning = false;

function formatTime(ms) {
    let totalSeconds = Math.floor(ms / 1000);
    let hours = Math.floor(totalSeconds / 3600); let minutes = Math.floor((totalSeconds % 3600) / 60); let seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function actualizarDisplayCrono() {
    if (!domElementCrono) domElementCrono = document.getElementById('display-cronometro');
    if (domElementCrono) domElementCrono.innerText = formatTime(elapsedTime + (isRunning ? Date.now() - startTime : 0));
}

function toggleCronometro() {
    const btn = document.getElementById('btn-comenzar-pausa');
    if (isRunning) {
        elapsedTime += Date.now() - startTime; clearInterval(timerInterval); isRunning = false;
        btn.innerHTML = '▶ REANUDAR'; btn.classList.remove('btn-crono-pausa');
    } else {
        startTime = Date.now(); timerInterval = setInterval(actualizarDisplayCrono, 1000); isRunning = true;
        btn.innerHTML = '⏸ PAUSAR'; btn.classList.add('btn-crono-pausa');
    }
}

function resetCronometro() {
    if(confirm('¿Seguro que querés reiniciar el tiempo a cero?')) {
        clearInterval(timerInterval); isRunning = false; elapsedTime = 0;
        const btn = document.getElementById('btn-comenzar-pausa');
        btn.innerHTML = '▶ COMENZAR'; btn.classList.remove('btn-crono-pausa'); actualizarDisplayCrono();
    }
}

// --- NAVEGACIÓN PRINCIPAL (OPTIMIZADA) ---
function renderizarSemana() {
    const contenedorTarjetas = document.getElementById('contenedor-tarjetas');
    let acumuladorHTML = ''; // Optimizando el pintado del DOM
    
    diasDeLaSemana.forEach(dia => {
        const completado = estadoDias[dia] || false;
        const claseColor = completado ? 'dia-verde' : '';
        const checkStatus = completado ? 'checked' : '';
        acumuladorHTML += `
            <div class="tarjeta-dia ${claseColor}" onclick="abrirDia('${dia}')">
                <span class="nombre-dia">${dia}</span>
                <span class="subtexto" style="margin-bottom: 10px;">Entrenar ➔</span>
                <button class="btn-wsp" onclick="avisarBro(event)" title="Avisarle a mi bro">
                    <svg viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.122.553 4.161 1.6 5.967L.25 23.582l5.736-1.503c1.745.966 3.711 1.474 5.762 1.474 6.645 0 12.03-5.385 12.03-12.03S18.676 0 12.031 0zm-.016 21.603c-1.782 0-3.52-.478-5.045-1.383l-.36-.214-3.75.982.998-3.655-.235-.373c-1-1.583-1.528-3.414-1.528-5.312 0-5.568 4.531-10.1 10.1-10.1 5.568 0 10.1 4.531 10.1 10.1s-4.531 10.1-10.1 10.1zm5.55-7.584c-.304-.152-1.802-.888-2.081-.992-.278-.103-.482-.152-.686.152-.204.304-.787.992-.966 1.196-.179.204-.358.228-.662.076-.304-.152-1.285-.473-2.45-1.517-.905-.812-1.516-1.815-1.695-2.119-.179-.304-.019-.469.133-.621.137-.137.304-.358.456-.538.152-.18.204-.304.304-.508.103-.204.051-.383-.025-.535-.076-.152-.686-1.65-.94-2.258-.247-.591-.497-.512-.686-.521-.179-.009-.384-.009-.588-.009-.204 0-.538.076-.821.383-.284.307-1.09 1.063-1.09 2.593 0 1.53 1.116 3.012 1.272 3.22.156.208 2.193 3.35 5.313 4.694.743.32 1.323.511 1.774.654.747.237 1.428.203 1.965.123.6-.088 1.802-.736 2.056-1.446.254-.71.254-1.319.179-1.446-.076-.127-.28-.203-.584-.355z"/></svg>
                </button>
                <input type="checkbox" class="checkbox-dia" ${checkStatus} onclick="event.stopPropagation();" onchange="marcarCompletado('${dia}', this.checked)">
            </div>
        `;
    });
    contenedorTarjetas.innerHTML = acumuladorHTML;
    document.getElementById('contador-total').innerText = totalEntrenamientos;
}

function marcarCompletado(dia, estaMarcado) {
    if (estaMarcado && !estadoDias[dia]) totalEntrenamientos++;
    estadoDias[dia] = estaMarcado; 
    localStorage.setItem('gymEstadoDias', JSON.stringify(estadoDias)); localStorage.setItem('gymTotalDias', totalEntrenamientos);
    renderizarSemana();
}

function reiniciarSemana() {
    if(confirm('¿Listo para destruir una nueva semana? Tus marcas se conservan.')) {
        estadoDias = {}; localStorage.setItem('gymEstadoDias', JSON.stringify(estadoDias)); renderizarSemana();
    }
}

function reiniciarContadorHistorico() {
    if(confirm('⚠️ ¿Seguro que querés reiniciar tus días de gloria a cero?')) {
        totalEntrenamientos = 0; localStorage.setItem('gymTotalDias', totalEntrenamientos); renderizarSemana();
    }
}

function cargarImagenMotivacion() {
    const contenedor = document.getElementById('contenedor-motivacion');
    // Elige un número al azar entre 1 y el TOTAL que definiste arriba
    const numeroAlAzar = Math.floor(Math.random() * TOTAL_IMAGENES_MOTIVACION) + 1;
    // Construye la ruta de la imagen (Ej: motivacion/3.jpg)
    const rutaImagen = `motivacion/${numeroAlAzar}.jpg`;
    
    contenedor.innerHTML = `<img src="${rutaImagen}" alt="Motivación Gym" style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px; border: 2px solid var(--accent-neon);">`;
}

function abrirDia(dia) {
    diaActivo = dia;
    document.getElementById('titulo-dia').innerText = `${dia} de Guerra`;
    document.getElementById('vista-semana').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'none';
    document.getElementById('vista-dia').style.display = 'flex';
    cargarImagenMotivacion(); actualizarInterfazDia(); actualizarDisplayCrono();
}

function volverSemana() {
    diaActivo = null;
    document.getElementById('vista-dia').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'none';
    document.getElementById('vista-semana').style.display = 'flex';
}

// --- LÓGICA DE CUENTA E HISTORIAL (OPTIMIZADA) ---
function abrirCuenta() {
    document.getElementById('vista-semana').style.display = 'none';
    document.getElementById('vista-dia').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'flex';
    renderizarHistorial();
}

function volverDesdeCuenta() { volverSemana(); }

function guardarDiaEnHistorial() {
    const rutinaActual = baseDeDatosLocal[diaActivo];
    if (!diaActivo || !rutinaActual || rutinaActual.length === 0) {
        alert("No tienes ejercicios cargados hoy para guardar."); return;
    }
    const fechaHoy = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    historialGlobal.unshift({
        fecha: fechaHoy, diaSemana: diaActivo, rutina: JSON.parse(JSON.stringify(rutinaActual)),
        tiempo: document.getElementById('display-cronometro').innerText
    });
    
    localStorage.setItem('gymHistorialGlobal', JSON.stringify(historialGlobal));
    alert(`¡Día guardado con éxito! Puedes verlo en tu Cuenta.\nTiempo registrado: ${document.getElementById('display-cronometro').innerText}`);
}

function borrarHistorialCompleto() {
    if(confirm('⚠️ ¿Estás completamente seguro de borrar TODO tu historial guardado? Esta acción no se puede deshacer.')) {
        historialGlobal = [];
        localStorage.setItem('gymHistorialGlobal', JSON.stringify(historialGlobal));
        renderizarHistorial();
        alert('Historial borrado con éxito.');
    }
}

function renderizarHistorial() {
    const contenedor = document.getElementById('contenedor-historial');
    if (historialGlobal.length === 0) {
        contenedor.innerHTML = '<p style="color: var(--text-muted);">Aún no has guardado ningún entrenamiento en tu historial.</p>';
        return;
    }

    let acumuladorHTML = ''; // Optimizando el pintado
    historialGlobal.forEach(registro => {
        let htmlEjercicios = '';
        registro.rutina.forEach(ej => {
            let htmlSeries = '';
            for (let i = 0; i < ej.series; i++) {
                const repes = (ej.repesRealizadas && ej.repesRealizadas[i]) ? ej.repesRealizadas[i] : '-';
                const peso = (ej.pesosRealizados && ej.pesosRealizados[i]) ? ej.pesosRealizados[i] : '-';
                htmlSeries += `<div class="mini-serie">S${i+1}: <strong>${repes}</strong>x<strong>${peso}kg</strong></div>`;
            }
            htmlEjercicios += `<div class="item-historial-ejercicio"><h4>${ej.nombre}</h4><div class="resumen-series">${htmlSeries}</div></div>`;
        });

        acumuladorHTML += `
            <div class="tarjeta-historial">
                <div class="fecha-historial">
                    ${registro.fecha} <span class="badge-dia">${registro.diaSemana} - ⏱ ${registro.tiempo}</span>
                </div>
                ${htmlEjercicios}
            </div>
        `;
    });
    contenedor.innerHTML = acumuladorHTML;
}

// --- LÓGICA DE LA RUTINA DIARIA (OPTIMIZADA) ---
function actualizarInterfazDia() {
    if (!diaActivo) return;
    const rutinaHoy = baseDeDatosLocal[diaActivo] || [];
    const contenedor = document.getElementById('listaEjerciciosUI');
    let acumuladorHTML = ''; // Optimizando el pintado

    rutinaHoy.forEach((ej, indexEjercicio) => {
        const valorFallo = fallosHistoricos[ej.nombre] || '';
        const valorPesoMax = pesosMaximos[ej.nombre] || '';
        
        let htmlSeries = '';
        for (let i = 0; i < ej.series; i++) {
            const repesGuardadas = (ej.repesRealizadas && ej.repesRealizadas[i]) ? ej.repesRealizadas[i] : ''; 
            const pesoGuardado = (ej.pesosRealizados && ej.pesosRealizados[i]) ? ej.pesosRealizados[i] : ''; 
            htmlSeries += `
                <div class="caja-serie">
                    <span class="numero-serie">SET ${i + 1}</span>
                    <span class="etiqueta-input">Repes</span>
                    <input type="number" class="input-datos" placeholder="-" value="${repesGuardadas}" onchange="guardarRepes(${indexEjercicio}, ${i}, this.value)">
                    <span class="etiqueta-input">Kg</span>
                    <input type="number" class="input-datos" placeholder="-" value="${pesoGuardado}" onchange="guardarPesoSerie(${indexEjercicio}, ${i}, this.value)">
                </div>
            `;
        }

        acumuladorHTML += `
            <div class="ejercicio-item">
                <div class="ejercicio-cabecera">
                    <h4 class="titulo-ejercicio">${ej.nombre}</h4>
                    <div class="contenedor-records">
                        <div class="caja-record"><label>Fallo</label><input type="number" placeholder="--" value="${valorFallo}" onchange="guardarFallo('${ej.nombre}', this.value)"></div>
                        <div class="caja-record"><label>Max Kg</label><input type="number" placeholder="--" value="${valorPesoMax}" onchange="guardarPesoMaximo('${ej.nombre}', this.value)"></div>
                        <button class="btn-eliminar" onclick="eliminarEjercicio(${indexEjercicio})">✖ Eliminar</button>
                    </div>
                </div>
                <div class="contenedor-series">${htmlSeries}</div>
            </div>
        `;
    });
    contenedor.innerHTML = acumuladorHTML;
}

function agregarEjercicio() {
    const nombre = document.getElementById('inputEjercicio').value.trim();
    const series = parseInt(document.getElementById('inputSeries').value);
    if (!nombre || !series) { alert("¡Hey! Completá el nombre y las series."); return; }
    if (!baseDeDatosLocal[diaActivo]) baseDeDatosLocal[diaActivo] = [];
    
    baseDeDatosLocal[diaActivo].push({ 
        nombre: nombre, series: series,
        repesRealizadas: new Array(series).fill(''), pesosRealizados: new Array(series).fill('') 
    });
    
    document.getElementById('inputEjercicio').value = ''; document.getElementById('inputSeries').value = '';
    guardarYRefrescarDia();
}

// --- MANEJO DE MEMORIA ---
function guardarRepes(indexEjercicio, indexSerie, valor) {
    const ej = baseDeDatosLocal[diaActivo][indexEjercicio];
    if (!ej.repesRealizadas) ej.repesRealizadas = new Array(ej.series).fill('');
    ej.repesRealizadas[indexSerie] = valor;
    localStorage.setItem('gymSemanaDB', JSON.stringify(baseDeDatosLocal));
}

function guardarPesoSerie(indexEjercicio, indexSerie, valor) {
    const ej = baseDeDatosLocal[diaActivo][indexEjercicio];
    if (!ej.pesosRealizados) ej.pesosRealizados = new Array(ej.series).fill('');
    ej.pesosRealizados[indexSerie] = valor;
    localStorage.setItem('gymSemanaDB', JSON.stringify(baseDeDatosLocal));
}

function guardarFallo(nombreEjercicio, valor) { fallosHistoricos[nombreEjercicio] = valor; localStorage.setItem('gymFallos', JSON.stringify(fallosHistoricos)); }
function guardarPesoMaximo(nombreEjercicio, valor) { pesosMaximos[nombreEjercicio] = valor; localStorage.setItem('gymPesosMaximos', JSON.stringify(pesosMaximos)); }
function eliminarEjercicio(index) { baseDeDatosLocal[diaActivo].splice(index, 1); guardarYRefrescarDia(); }
function guardarYRefrescarDia() { localStorage.setItem('gymSemanaDB', JSON.stringify(baseDeDatosLocal)); actualizarInterfazDia(); }

// --- ARRANQUE DE LA APP ---
cargarNombre();
renderizarSemana();