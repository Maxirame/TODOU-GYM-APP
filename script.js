// ==========================================
// 1. IMPORTACIONES DE FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Tu Llave Maestra
const firebaseConfig = {
  apiKey: "AIzaSyA91qTTlkWMA5H9cEvI1yja5j3WmkzEbqY",
  authDomain: "gym-app-social.firebaseapp.com",
  projectId: "gym-app-social",
  storageBucket: "gym-app-social.firebasestorage.app",
  messagingSenderId: "788607838572",
  appId: "1:788607838572:web:85ea3b15fdf467671aab49"
};

// Inicializamos el motor
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// 2. VARIABLES DE MEMORIA DE LA APP
// ==========================================
const diasDeLaSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TOTAL_IMAGENES_MOTIVACION = 8; 

let baseDeDatosLocal = {};
let estadoDias = {};
let totalEntrenamientos = 0;
let fallosHistoricos = {}; 
let pesosMaximos = {}; 
let historialGlobal = []; 
let diaActivo = null;
let domElementCrono = null;

// ==========================================
// 3. SISTEMA DE AUTENTICACIÓN (LOGIN)
// ==========================================

// El "Vigilante" que revisa si estás logueado
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('vista-auth').style.display = 'none';
        document.getElementById('vista-semana').style.display = 'flex';
        await cargarDatosDeNube(user.uid);
    } else {
        document.getElementById('vista-auth').style.display = 'flex';
        document.getElementById('vista-semana').style.display = 'none';
        document.getElementById('vista-dia').style.display = 'none';
        document.getElementById('vista-cuenta').style.display = 'none';
    }
});

window.iniciarSesion = async function() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errorMsg = document.getElementById('auth-error');
    if(!email || !pass) { errorMsg.innerText = "Completa los campos"; return; }
    
    try {
        errorMsg.innerText = "Cargando...";
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        errorMsg.innerText = "Error: Verifica tu correo o contraseña.";
    }
}

window.registrarUsuario = async function() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errorMsg = document.getElementById('auth-error');
    if(!email || !pass) { errorMsg.innerText = "Completa los campos"; return; }
    
    try {
        errorMsg.innerText = "Creando cuenta...";
        await createUserWithEmailAndPassword(auth, email, pass);
        setTimeout(() => window.editarNombre(), 1500); // Le pedimos el nombre tras registrarse
    } catch (error) {
        errorMsg.innerText = "Error: La contraseña debe tener al menos 6 caracteres.";
    }
}

window.cerrarSesion = function() {
    signOut(auth);
}

// ==========================================
// 4. SINCRONIZACIÓN CON FIREBASE (NUBE)
// ==========================================

async function guardarDatosEnNube() {
    if (!auth.currentUser) return;
    const userRef = doc(db, "usuarios", auth.currentUser.uid);
    
    // Subimos todo al perfil del usuario actual
    await setDoc(userRef, {
        baseDeDatosLocal,
        estadoDias,
        totalEntrenamientos,
        fallosHistoricos,
        pesosMaximos,
        historialGlobal,
        nombre: document.getElementById('nombre-usuario').innerText
    }, { merge: true });
}

async function cargarDatosDeNube(uid) {
    const userRef = doc(db, "usuarios", uid);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        baseDeDatosLocal = data.baseDeDatosLocal || {};
        estadoDias = data.estadoDias || {};
        totalEntrenamientos = data.totalEntrenamientos || 0;
        fallosHistoricos = data.fallosHistoricos || {};
        pesosMaximos = data.pesosMaximos || {};
        historialGlobal = data.historialGlobal || [];
        
        if(data.nombre) {
            document.getElementById('nombre-usuario').innerText = data.nombre;
            document.getElementById('titulo-perfil-nombre').innerText = data.nombre;
            document.getElementById('letra-avatar').innerText = data.nombre.charAt(0).toUpperCase();
        } else {
            document.getElementById('nombre-usuario').innerText = "Atleta";
        }
    } else {
        // Es un usuario nuevo, la libreta está en blanco
        baseDeDatosLocal = {}; estadoDias = {}; totalEntrenamientos = 0; 
        fallosHistoricos = {}; pesosMaximos = {}; historialGlobal = [];
        document.getElementById('nombre-usuario').innerText = "Atleta";
    }
    renderizarSemana();
}

window.editarNombre = function() {
    let nombreActual = document.getElementById('nombre-usuario').innerText;
    let nuevoNombre = prompt("Ingresa tu nombre de atleta:", nombreActual);
    
    if (nuevoNombre !== null && nuevoNombre.trim() !== "") {
        const finalName = nuevoNombre.trim();
        document.getElementById('nombre-usuario').innerText = finalName;
        document.getElementById('titulo-perfil-nombre').innerText = finalName;
        document.getElementById('letra-avatar').innerText = finalName.charAt(0).toUpperCase();
        guardarDatosEnNube();
    }
}

// ==========================================
// 5. LÓGICA DE LA APP (ADAPTADA A LA NUBE)
// ==========================================

window.renderizarSemana = function() {
    const contenedorTarjetas = document.getElementById('contenedor-tarjetas');
    let acumuladorHTML = ''; 
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

window.marcarCompletado = function(dia, estaMarcado) {
    if (estaMarcado && !estadoDias[dia]) totalEntrenamientos++;
    estadoDias[dia] = estaMarcado; 
    guardarDatosEnNube();
    renderizarSemana();
}

window.reiniciarSemana = function() {
    if(confirm('¿Listo para destruir una nueva semana? Tus marcas se conservan.')) {
        estadoDias = {}; 
        guardarDatosEnNube();
        renderizarSemana();
    }
}

window.reiniciarContadorHistorico = function() {
    if(confirm('⚠️ ¿Seguro que querés reiniciar tus días de gloria a cero?')) {
        totalEntrenamientos = 0; 
        guardarDatosEnNube();
        renderizarSemana();
    }
}

function cargarImagenMotivacion() {
    const contenedor = document.getElementById('contenedor-motivacion');
    const numeroAlAzar = Math.floor(Math.random() * TOTAL_IMAGENES_MOTIVACION) + 1;
    const rutaImagen = `motivacion/${numeroAlAzar}.jpg`;
    contenedor.innerHTML = `<img src="${rutaImagen}" alt="Motivación Gym" style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px; border: 2px solid var(--accent-neon);">`;
}

window.abrirDia = function(dia) {
    diaActivo = dia;
    document.getElementById('titulo-dia').innerText = `${dia} de Guerra`;
    document.getElementById('vista-semana').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'none';
    document.getElementById('vista-dia').style.display = 'flex';
    cargarImagenMotivacion(); 
    actualizarInterfazDia(); 
    actualizarDisplayCrono();
}

window.volverSemana = function() {
    diaActivo = null;
    document.getElementById('vista-dia').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'none';
    document.getElementById('vista-semana').style.display = 'flex';
}

window.abrirCuenta = function() {
    document.getElementById('vista-semana').style.display = 'none';
    document.getElementById('vista-dia').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'flex';
    renderizarHistorial();
}

window.volverDesdeCuenta = function() { volverSemana(); }

window.guardarDiaEnHistorial = function() {
    const rutinaActual = baseDeDatosLocal[diaActivo];
    if (!diaActivo || !rutinaActual || rutinaActual.length === 0) {
        alert("No tienes ejercicios cargados hoy para guardar."); return;
    }
    const fechaHoy = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    historialGlobal.unshift({
        fecha: fechaHoy, diaSemana: diaActivo, rutina: JSON.parse(JSON.stringify(rutinaActual)),
        tiempo: document.getElementById('display-cronometro').innerText
    });
    
    guardarDatosEnNube();
    alert(`¡Día guardado con éxito! Puedes verlo en tu Cuenta.\nTiempo registrado: ${document.getElementById('display-cronometro').innerText}`);
}

window.borrarHistorialCompleto = function() {
    if(confirm('⚠️ ¿Estás completamente seguro de borrar TODO tu historial guardado? Esta acción no se puede deshacer.')) {
        historialGlobal = [];
        guardarDatosEnNube();
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

    let acumuladorHTML = ''; 
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

function actualizarInterfazDia() {
    if (!diaActivo) return;
    const rutinaHoy = baseDeDatosLocal[diaActivo] || [];
    const contenedor = document.getElementById('listaEjerciciosUI');
    let acumuladorHTML = ''; 

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

window.agregarEjercicio = function() {
    const nombre = document.getElementById('inputEjercicio').value.trim();
    const series = parseInt(document.getElementById('inputSeries').value);
    if (!nombre || !series) { alert("¡Hey! Completá el nombre y las series."); return; }
    if (!baseDeDatosLocal[diaActivo]) baseDeDatosLocal[diaActivo] = [];
    
    baseDeDatosLocal[diaActivo].push({ 
        nombre: nombre, series: series,
        repesRealizadas: new Array(series).fill(''), pesosRealizados: new Array(series).fill('') 
    });
    
    document.getElementById('inputEjercicio').value = ''; document.getElementById('inputSeries').value = '';
    guardarDatosEnNube();
    actualizarInterfazDia();
}

window.guardarRepes = function(indexEjercicio, indexSerie, valor) {
    const ej = baseDeDatosLocal[diaActivo][indexEjercicio];
    if (!ej.repesRealizadas) ej.repesRealizadas = new Array(ej.series).fill('');
    ej.repesRealizadas[indexSerie] = valor;
    guardarDatosEnNube();
}

window.guardarPesoSerie = function(indexEjercicio, indexSerie, valor) {
    const ej = baseDeDatosLocal[diaActivo][indexEjercicio];
    if (!ej.pesosRealizados) ej.pesosRealizados = new Array(ej.series).fill('');
    ej.pesosRealizados[indexSerie] = valor;
    guardarDatosEnNube();
}

window.guardarFallo = function(nombreEjercicio, valor) { fallosHistoricos[nombreEjercicio] = valor; guardarDatosEnNube(); }
window.guardarPesoMaximo = function(nombreEjercicio, valor) { pesosMaximos[nombreEjercicio] = valor; guardarDatosEnNube(); }
window.eliminarEjercicio = function(index) { baseDeDatosLocal[diaActivo].splice(index, 1); guardarDatosEnNube(); actualizarInterfazDia(); }

window.toggleCronometro = function() {
    const btn = document.getElementById('btn-comenzar-pausa');
    if (isRunning) {
        elapsedTime += Date.now() - startTime; clearInterval(timerInterval); isRunning = false;
        btn.innerHTML = '▶ REANUDAR'; btn.classList.remove('btn-crono-pausa');
    } else {
        startTime = Date.now(); timerInterval = setInterval(actualizarDisplayCrono, 1000); isRunning = true;
        btn.innerHTML = '⏸ PAUSAR'; btn.classList.add('btn-crono-pausa');
    }
}

window.resetCronometro = function() {
    if(confirm('¿Seguro que querés reiniciar el tiempo a cero?')) {
        clearInterval(timerInterval); isRunning = false; elapsedTime = 0;
        const btn = document.getElementById('btn-comenzar-pausa');
        btn.innerHTML = '▶ COMENZAR'; btn.classList.remove('btn-crono-pausa'); actualizarDisplayCrono();
    }
}
window.avisarBro = avisarBro;
