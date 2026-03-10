// ==========================================
// 1. IMPORTACIONES DE FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, sendEmailVerification, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA91qTTlkWMA5H9cEvI1yja5j3WmkzEbqY",
  authDomain: "gym-app-social.firebaseapp.com",
  projectId: "gym-app-social",
  storageBucket: "gym-app-social.firebasestorage.app",
  messagingSenderId: "788607838572",
  appId: "1:788607838572:web:85ea3b15fdf467671aab49"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserSessionPersistence); 

// ==========================================
// 2. ESTADO GLOBAL DE LA APP
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
let startTime, elapsedTime = 0, timerInterval, isRunning = false;

// ==========================================
// DICCIONARIO DE TÉCNICAS (VIDEOS E IMÁGENES)
// ==========================================
// Aquí puedes agregar todos tus ejercicios. Asegúrate de crear
// las carpetas "videos" e "img" y colocar los archivos allí.
const infoEjercicios = {
    "Press Banca": {
        videoUrl: "videos/press_banca.mp4",
        imgMusculo: "img/pecho.png"
    },
    "Sentadillas": {
        videoUrl: "videos/sentadillas.mp4",
        imgMusculo: "img/cuadriceps.png"
    },
    "Dominadas Supinas": {
        videoUrl: "videos/dominadas.mp4",
        imgMusculo: "img/espalda.png"
    }
};

// ==========================================
// 3. SISTEMA DE AUTENTICACIÓN
// ==========================================
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

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errorMsg = document.getElementById('auth-error');
    if(!email || !pass) return errorMsg.innerText = "⚠️ Completa ambos campos.";
    try {
        errorMsg.innerText = "Cargando...";
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) { errorMsg.innerText = "⚠️ Error: Verifica tu correo o contraseña."; }
});

document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errorMsg = document.getElementById('auth-error');
    if(!email || !pass) return errorMsg.innerText = "⚠️ Completa ambos campos.";
    try {
        errorMsg.innerText = "Creando cuenta...";
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        await sendEmailVerification(userCredential.user);
        alert("¡Cuenta creada exitosamente! Te hemos enviado un correo para verificar tu identidad.");
        setTimeout(() => editarNombre(), 1000); 
    } catch (error) {
        if (error.code === 'auth/weak-password') errorMsg.innerText = "⚠️ La contraseña debe tener al menos 6 caracteres.";
        else if (error.code === 'auth/email-already-in-use') errorMsg.innerText = "⚠️ Ese correo ya está registrado.";
        else errorMsg.innerText = "⚠️ Error: " + error.code;
    }
});

document.getElementById('btn-google').addEventListener('click', async () => {
    const errorMsg = document.getElementById('auth-error');
    try {
        errorMsg.innerText = "Abriendo ventana de Google...";
        await signInWithPopup(auth, new GoogleAuthProvider());
        if (auth.currentUser.displayName) document.getElementById('nombre-usuario').innerText = auth.currentUser.displayName.split(" ")[0];
    } catch (error) { errorMsg.innerText = "⚠️ Error al conectar con Google."; }
});

document.getElementById('btn-cerrar-sesion-main').addEventListener('click', () => signOut(auth));

// ==========================================
// 4. BASE DE DATOS Y SINCRONIZACIÓN
// ==========================================
async function guardarDatosEnNube() {
    if (!auth.currentUser) return;
    try {
        await setDoc(doc(db, "usuarios", auth.currentUser.uid), {
            baseDeDatosLocal, estadoDias, totalEntrenamientos, fallosHistoricos, pesosMaximos, historialGlobal,
            nombre: document.getElementById('nombre-usuario').innerText
        }, { merge: true });
    } catch (e) { console.warn("Modo local activo"); }
}

async function cargarDatosDeNube(uid) {
    try {
        const docSnap = await getDoc(doc(db, "usuarios", uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            baseDeDatosLocal = data.baseDeDatosLocal || {}; estadoDias = data.estadoDias || {};
            totalEntrenamientos = data.totalEntrenamientos || 0; fallosHistoricos = data.fallosHistoricos || {};
            pesosMaximos = data.pesosMaximos || {}; historialGlobal = data.historialGlobal || [];
            document.getElementById('nombre-usuario').innerText = data.nombre || "Atleta";
            document.getElementById('titulo-perfil-nombre').innerText = data.nombre || "Atleta";
            document.getElementById('letra-avatar').innerText = (data.nombre || "A").charAt(0).toUpperCase();
        } else {
            baseDeDatosLocal = {}; estadoDias = {}; totalEntrenamientos = 0; fallosHistoricos = {}; pesosMaximos = {}; historialGlobal = [];
            document.getElementById('nombre-usuario').innerText = auth.currentUser.displayName ? auth.currentUser.displayName.split(" ")[0] : "Atleta";
        }
    } catch (error) {
        alert("⚠️ Base de datos inactiva. Modo Offline.");
        baseDeDatosLocal = {}; estadoDias = {}; totalEntrenamientos = 0; fallosHistoricos = {}; pesosMaximos = {}; historialGlobal = [];
    }
    renderizarSemana();
}

function editarNombre() {
    let nuevoNombre = prompt("Ingresa tu nombre de atleta:", document.getElementById('nombre-usuario').innerText);
    if (nuevoNombre && nuevoNombre.trim() !== "") {
        const n = nuevoNombre.trim();
        document.getElementById('nombre-usuario').innerText = n;
        document.getElementById('titulo-perfil-nombre').innerText = n;
        document.getElementById('letra-avatar').innerText = n.charAt(0).toUpperCase();
        guardarDatosEnNube();
    }
}
document.getElementById('btn-editar-nombre').addEventListener('click', editarNombre);

// ==========================================
// 5. LÓGICA DE UI Y EVENTOS OPTIMIZADOS
// ==========================================

function renderizarSemana() {
    const contenedor = document.getElementById('contenedor-tarjetas');
    contenedor.innerHTML = diasDeLaSemana.map(dia => {
        const checkStatus = estadoDias[dia] ? 'checked' : '';
        const claseColor = estadoDias[dia] ? 'dia-verde' : '';
        return `
            <div class="tarjeta-dia ${claseColor}" data-dia="${dia}">
                <span class="nombre-dia">${dia}</span>
                <span class="subtexto" style="margin-bottom: 10px;">Entrenar ➔</span>
                <button class="btn-wsp" title="Avisarle a mi bro">
                    <svg viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.122.553 4.161 1.6 5.967L.25 23.582l5.736-1.503c1.745.966 3.711 1.474 5.762 1.474 6.645 0 12.03-5.385 12.03-12.03S18.676 0 12.031 0zm-.016 21.603c-1.782 0-3.52-.478-5.045-1.383l-.36-.214-3.75.982.998-3.655-.235-.373c-1-1.583-1.528-3.414-1.528-5.312 0-5.568 4.531-10.1 10.1-10.1 5.568 0 10.1 4.531 10.1 10.1s-4.531 10.1-10.1 10.1zm5.55-7.584c-.304-.152-1.802-.888-2.081-.992-.278-.103-.482-.152-.686.152-.204.304-.787.992-.966 1.196-.179.204-.358.228-.662.076-.304-.152-1.285-.473-2.45-1.517-.905-.812-1.516-1.815-1.695-2.119-.179-.304-.019-.469.133-.621.137-.137.304-.358.456-.538.152-.18.204-.304.304-.508.103-.204.051-.383-.025-.535-.076-.152-.686-1.65-.94-2.258-.247-.591-.497-.512-.686-.521-.179-.009-.384-.009-.588-.009-.204 0-.538.076-.821.383-.284.307-1.09 1.063-1.09 2.593 0 1.53 1.116 3.012 1.272 3.22.156.208 2.193 3.35 5.313 4.694.743.32 1.323.511 1.774.654.747.237 1.428.203 1.965.123.6-.088 1.802-.736 2.056-1.446.254-.71.254-1.319.179-1.446-.076-.127-.28-.203-.584-.355z"/></svg>
                </button>
                <input type="checkbox" class="checkbox-dia" data-checkdia="${dia}" ${checkStatus}>
            </div>
        `;
    }).join('');
    document.getElementById('contador-total').innerText = totalEntrenamientos;
}

document.getElementById('contenedor-tarjetas').addEventListener('click', (e) => {
    if (e.target.closest('.btn-wsp')) return window.open("https://chat.whatsapp.com/GPtrTGFtMhk8icwQlcMbfw", '_blank');
    if (e.target.classList.contains('checkbox-dia')) return; 
    const tarjeta = e.target.closest('.tarjeta-dia');
    if (tarjeta) abrirDia(tarjeta.getAttribute('data-dia'));
});

document.getElementById('contenedor-tarjetas').addEventListener('change', (e) => {
    if (e.target.classList.contains('checkbox-dia')) {
        const dia = e.target.getAttribute('data-checkdia');
        if (e.target.checked && !estadoDias[dia]) totalEntrenamientos++;
        estadoDias[dia] = e.target.checked; 
        guardarDatosEnNube(); renderizarSemana();
    }
});

function actualizarInterfazDia() {
    if (!diaActivo) return;
    const rutinaHoy = baseDeDatosLocal[diaActivo] || [];
    
    document.getElementById('listaEjerciciosUI').innerHTML = rutinaHoy.map((ej, idx) => {
        let htmlSeries = '';
        for (let i = 0; i < ej.series; i++) {
            const r = (ej.repesRealizadas && ej.repesRealizadas[i]) || ''; 
            const p = (ej.pesosRealizados && ej.pesosRealizados[i]) || ''; 
            const isCompleted = (ej.seriesCompletadas && ej.seriesCompletadas[i]) ? 'completada' : '';

            htmlSeries += `
                <div class="caja-serie ${isCompleted}">
                    <span class="numero-serie">S${i + 1}</span>
                    <div class="inputs-fila">
                        <input type="number" class="input-datos input-repes" data-ej="${idx}" data-serie="${i}" placeholder="-" value="${r}">
                        <span class="etiqueta-x">x</span>
                        <input type="number" class="input-datos input-peso" data-ej="${idx}" data-serie="${i}" placeholder="-" value="${p}">
                        <span class="etiqueta-kg">kg</span>
                    </div>
                    <button class="btn-check-serie" data-ej="${idx}" data-serie="${i}">✔</button>
                </div>`;
        }
        
        const prReps = fallosHistoricos[ej.nombre] || '--';
        const prPeso = pesosMaximos[ej.nombre] || '--';

        // Buscamos info en el diccionario. Si no hay, devolvemos strings vacíos.
        const infoTecnica = infoEjercicios[ej.nombre] || { videoUrl: "", imgMusculo: "" };
        
        // Estructura de la parte TRASERA de la carta
        const htmlBack = infoTecnica.videoUrl ? `
            <div class="header-back-carta">
                <h4 style="color: var(--accent-neon); margin: 0; font-size: 14px; text-transform: uppercase;">Técnica de Ejercicio</h4>
                <button class="btn-cerrar-back btn-flip-back" data-ej="${idx}" title="Volver">✖</button>
            </div>
            <div class="video-container" style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                <video width="100%" controls style="border-radius: 8px; border: 1px solid var(--border-color);">
                    <source src="${infoTecnica.videoUrl}" type="video/mp4">
                    Tu navegador no soporta videos.
                </video>
                <div style="margin-top: 15px; text-align: center;">
                    <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 800;">Músculo Principal</span><br>
                    <img src="${infoTecnica.imgMusculo}" alt="Músculo" style="height: 40px; margin-top: 5px; opacity: 0.8;" onerror="this.style.display='none'">
                </div>
            </div>
        ` : `
            <div class="header-back-carta">
                <h4 style="color: var(--text-muted); margin: 0; font-size: 14px; text-transform: uppercase;">Sin Información</h4>
                <button class="btn-cerrar-back btn-flip-back" data-ej="${idx}" title="Volver">✖</button>
            </div>
            <p style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 20px;">Aún no has cargado un video para este ejercicio en el código.</p>
        `;

        // Retornamos el contenedor 3D completo
        return `
            <div class="ejercicio-flip-container">
                <div class="ejercicio-card-inner" id="card-inner-${idx}">
                    
                    <div class="ejercicio-card-front ejercicio-item">
                        <div class="ejercicio-header-top">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button class="btn-info-carta btn-flip" data-ej="${idx}" title="Ver Técnica">!</button>
                                <h4 class="titulo-ejercicio">${ej.nombre}</h4>
                            </div>
                            <button class="btn-eliminar btn-borrar-ejercicio" data-ej="${idx}" title="Eliminar Ejercicio">✖</button>
                        </div>
                        <div class="badge-pr" id="pr-${idx}">🏆 Fallo: ${prPeso}kg x ${prReps} repes</div>
                        <div class="contenedor-series">${htmlSeries}</div>
                    </div>

                    <div class="ejercicio-card-back ejercicio-item">
                        ${htmlBack}
                    </div>

                </div>
            </div>`;
    }).join('');
}

const listaUI = document.getElementById('listaEjerciciosUI');

listaUI.addEventListener('click', (e) => {
    // 1. Eliminar Ejercicio (solo si tiene la clase específica)
    if (e.target.classList.contains('btn-borrar-ejercicio')) {
        if(confirm('¿Borrar este ejercicio del día?')) {
            baseDeDatosLocal[diaActivo].splice(e.target.getAttribute('data-ej'), 1);
            guardarDatosEnNube(); actualizarInterfazDia();
        }
    }
    
    // 2. Giro de carta (Flip hacia atrás)
    if (e.target.classList.contains('btn-flip')) {
        const ejIdx = e.target.getAttribute('data-ej');
        document.getElementById(`card-inner-${ejIdx}`).classList.add('flipped');
    }
    
    // 3. Giro de carta (Flip hacia adelante)
    if (e.target.classList.contains('btn-flip-back')) {
        const ejIdx = e.target.getAttribute('data-ej');
        document.getElementById(`card-inner-${ejIdx}`).classList.remove('flipped');
    }
    
    // 4. Check de Series Completadas
    const btnCheck = e.target.closest('.btn-check-serie');
    if (btnCheck) {
        const ejIdx = btnCheck.getAttribute('data-ej');
        const serieIdx = btnCheck.getAttribute('data-serie');
        
        if (!baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas) {
            baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas = new Array(baseDeDatosLocal[diaActivo][ejIdx].series).fill(false);
        }
        
        baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas[serieIdx] = !baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas[serieIdx];
        
        guardarDatosEnNube(); 
        actualizarInterfazDia(); 
    }
});

listaUI.addEventListener('change', (e) => {
    const t = e.target;
    if (t.classList.contains('input-repes') || t.classList.contains('input-peso')) {
        const ejIdx = t.getAttribute('data-ej'); const serieIdx = t.getAttribute('data-serie');
        const tipo = t.classList.contains('input-repes') ? 'repesRealizadas' : 'pesosRealizados';
        
        if (!baseDeDatosLocal[diaActivo][ejIdx][tipo]) {
            baseDeDatosLocal[diaActivo][ejIdx][tipo] = new Array(baseDeDatosLocal[diaActivo][ejIdx].series).fill('');
        }
        baseDeDatosLocal[diaActivo][ejIdx][tipo][serieIdx] = t.value;
        
        const nombreEj = baseDeDatosLocal[diaActivo][ejIdx].nombre;
        const repsStr = baseDeDatosLocal[diaActivo][ejIdx].repesRealizadas[serieIdx];
        const pesoStr = baseDeDatosLocal[diaActivo][ejIdx].pesosRealizados[serieIdx];
        
        if (repsStr !== '' && pesoStr !== '' && repsStr !== undefined && pesoStr !== undefined) {
            const currentReps = parseFloat(repsStr);
            const currentPeso = parseFloat(pesoStr);
            
            let maxPesoGuardado = parseFloat(pesosMaximos[nombreEj]) || 0;
            let maxRepsGuardadas = parseFloat(fallosHistoricos[nombreEj]) || 0;

            let isNewPR = false;

            if (currentPeso > maxPesoGuardado) {
                isNewPR = true;
            } else if (currentPeso === maxPesoGuardado && currentReps > maxRepsGuardadas) {
                isNewPR = true;
            }

            if (isNewPR) {
                pesosMaximos[nombreEj] = currentPeso;
                fallosHistoricos[nombreEj] = currentReps;
                
                const badge = document.getElementById(`pr-${ejIdx}`);
                if(badge) {
                    badge.innerText = `🏆 Fallo: ${currentPeso}kg x ${currentReps} repes`;
                    badge.style.color = "var(--success-green)";
                    setTimeout(() => { badge.style.color = "var(--text-muted)"; }, 1500);
                }
            }
        }
        guardarDatosEnNube();
    }
});

document.getElementById('btn-agregar-ejercicio').addEventListener('click', () => {
    const nombre = document.getElementById('inputEjercicio').value.trim();
    const series = parseInt(document.getElementById('inputSeries').value);
    if (!nombre || !series) return alert("¡Hey! Completá el nombre y las series.");
    if (!baseDeDatosLocal[diaActivo]) baseDeDatosLocal[diaActivo] = [];
    
    baseDeDatosLocal[diaActivo].push({ 
        nombre, series, 
        repesRealizadas: new Array(series).fill(''), 
        pesosRealizados: new Array(series).fill(''),
        seriesCompletadas: new Array(series).fill(false)
    });
    
    document.getElementById('inputEjercicio').value = ''; document.getElementById('inputSeries').value = '';
    guardarDatosEnNube(); actualizarInterfazDia();
});

document.getElementById('btn-limpiar-checks').addEventListener('click', () => {
    const rutina = baseDeDatosLocal[diaActivo];
    if (!diaActivo || !rutina || rutina.length === 0) return;
    
    if(confirm('¿Seguro que quieres desmarcar todas las series de hoy? Tus pesos anotados no se borrarán.')) {
        rutina.forEach(ej => {
            if(ej.seriesCompletadas) {
                ej.seriesCompletadas = new Array(ej.series).fill(false);
            }
        });
        guardarDatosEnNube();
        actualizarInterfazDia();
    }
});

// --- CRONÓMETRO Y FLUJO DE VENTANAS ---
function formatTime(ms) {
    let secs = Math.floor(ms / 1000);
    return `${String(Math.floor(secs / 3600)).padStart(2,'0')}:${String(Math.floor((secs % 3600) / 60)).padStart(2,'0')}:${String(secs % 60).padStart(2,'0')}`;
}
function actualizarDisplayCrono() { document.getElementById('display-cronometro').innerText = formatTime(elapsedTime + (isRunning ? Date.now() - startTime : 0)); }

document.getElementById('btn-comenzar-pausa').addEventListener('click', () => {
    const btn = document.getElementById('btn-comenzar-pausa');
    if (isRunning) { elapsedTime += Date.now() - startTime; clearInterval(timerInterval); isRunning = false; btn.innerHTML = '▶ REANUDAR'; btn.classList.remove('btn-crono-pausa');
    } else { startTime = Date.now(); timerInterval = setInterval(actualizarDisplayCrono, 1000); isRunning = true; btn.innerHTML = '⏸ PAUSAR'; btn.classList.add('btn-crono-pausa'); }
});
document.getElementById('btn-reset-crono').addEventListener('click', () => {
    if(confirm('¿Seguro que querés reiniciar el tiempo a cero?')) { clearInterval(timerInterval); isRunning = false; elapsedTime = 0; document.getElementById('btn-comenzar-pausa').innerHTML = '▶ COMENZAR'; document.getElementById('btn-comenzar-pausa').classList.remove('btn-crono-pausa'); actualizarDisplayCrono(); }
});

function abrirDia(dia) {
    diaActivo = dia;
    document.getElementById('titulo-dia').innerText = `${dia} de Guerra`;
    document.getElementById('vista-semana').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'none';
    document.getElementById('vista-dia').style.display = 'flex';
    document.getElementById('contenedor-motivacion').innerHTML = `<img src="motivacion/${Math.floor(Math.random() * TOTAL_IMAGENES_MOTIVACION) + 1}.jpg" alt="Motivación Gym" style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px; border: 2px solid var(--accent-neon);">`;
    actualizarInterfazDia(); actualizarDisplayCrono();
}

document.getElementById('btn-volver-semana').addEventListener('click', () => { diaActivo = null; document.getElementById('vista-dia').style.display = 'none'; document.getElementById('vista-cuenta').style.display = 'none'; document.getElementById('vista-semana').style.display = 'flex'; });
document.getElementById('btn-abrir-cuenta').addEventListener('click', () => { document.getElementById('vista-semana').style.display = 'none'; document.getElementById('vista-dia').style.display = 'none'; document.getElementById('vista-cuenta').style.display = 'flex'; renderizarHistorial(); });
document.getElementById('btn-volver-desde-cuenta').addEventListener('click', () => { document.getElementById('vista-dia').style.display = 'none'; document.getElementById('vista-cuenta').style.display = 'none'; document.getElementById('vista-semana').style.display = 'flex'; });

document.getElementById('btn-guardar-dia').addEventListener('click', () => {
    if (!diaActivo || !baseDeDatosLocal[diaActivo] || baseDeDatosLocal[diaActivo].length === 0) return alert("No tienes ejercicios cargados hoy para guardar.");
    historialGlobal.unshift({ fecha: new Date().toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' }), diaSemana: diaActivo, rutina: JSON.parse(JSON.stringify(baseDeDatosLocal[diaActivo])), tiempo: document.getElementById('display-cronometro').innerText });
    guardarDatosEnNube(); alert(`¡Día guardado con éxito!\nTiempo: ${document.getElementById('display-cronometro').innerText}`);
});

document.getElementById('btn-reiniciar-semana').addEventListener('click', () => { if(confirm('¿Destruir la semana? Tus récords y el historial se conservan.')) { estadoDias = {}; guardarDatosEnNube(); renderizarSemana(); } });
document.getElementById('btn-reiniciar-historico').addEventListener('click', () => { if(confirm('⚠️ ¿Reiniciar tus días totales de gloria a cero?')) { totalEntrenamientos = 0; guardarDatosEnNube(); renderizarSemana(); } });
document.getElementById('btn-borrar-todo').addEventListener('click', () => { if(confirm('⚠️ ¿Estás seguro de borrar TODO tu historial guardado? Esta acción no se puede deshacer.')) { historialGlobal = []; guardarDatosEnNube(); renderizarHistorial(); alert('Historial borrado con éxito.'); } });

function renderizarHistorial() {
    const contenedor = document.getElementById('contenedor-historial');
    if (historialGlobal.length === 0) return contenedor.innerHTML = '<p style="color: var(--text-muted);">Aún no has guardado ningún entrenamiento.</p>';
    contenedor.innerHTML = historialGlobal.map(registro => `
        <div class="tarjeta-historial">
            <div class="fecha-historial">${registro.fecha} <span class="badge-dia">${registro.diaSemana} - ⏱ ${registro.tiempo}</span></div>
            ${registro.rutina.map(ej => `
                <div class="item-historial-ejercicio"><h4>${ej.nombre}</h4><div class="resumen-series">
                    ${Array.from({length: ej.series}).map((_, i) => `<div class="mini-serie">S${i+1}: <strong>${(ej.repesRealizadas && ej.repesRealizadas[i]) || '-'}</strong>x<strong>${(ej.pesosRealizados && ej.pesosRealizados[i]) || '-'}kg</strong></div>`).join('')}
                </div></div>
            `).join('')}
        </div>`).join('');
}
