// script.js

const tituloProjeto = document.getElementById('titulo-projeto');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const contador = document.getElementById('contador-dedos');
const btnIniciar = document.getElementById('btn-iniciar');
const controlPanel = document.querySelector('.control-panel');

const quizContainer = document.getElementById('quiz-container');
const perguntaBlock = document.getElementById('pergunta-block');
const disciplinaBlock = document.getElementById('disciplina-block');
const dificuldadeBlock = document.getElementById('dificuldade-block');
const opcoesEl = document.getElementById('opcoes');
const scoreEl = document.getElementById('score-block');

const diffContainer = document.getElementById('difficulty-container');
const diffItems = Array.from(document.querySelectorAll('#dificuldades li'));

const btnExit = document.getElementById('btn-exit');
const resultsScreen = document.getElementById('results-screen');
const finalScore = document.getElementById('final-score');
const btnRestart = document.getElementById('btn-restart');
const maoStatus = document.getElementById('mao-status');
const fingerCursor = document.getElementById('finger-cursor');

const feedbackContainer = document.getElementById('feedback-container');
const feedbackMessage = document.getElementById('feedback-message');
const btnNext = document.getElementById('btn-next');

const cronometro = document.getElementById('cronometro');
const startPauseBtn = document.getElementById('startPause');
const zerarBtn = document.getElementById('zerar');

let jogoIniciado = false;
let perguntasSelecionadas = [];
let perguntaAtual = 0;
let score = 0;

let tempoRestante = 15;
let intervaloTempo;

let errosRodada = 0;

// timers de hover-gesto
let currentDiffHover = null;
let selecionarDificTimer = null;
let currentOpcHover = null;
let selecionarOpcTimer = null;
let exitTimer = null;
let restartTimer = null;
let nextTimer = null;

let timeDelay = 1000;

// esconde Sair até o quiz começar
btnExit.style.display = 'none';

// Helpers
function pontoSobre(x, y, el) {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
function pontoSobreAlcance(x, y, el, m = 40) {
  const r = el.getBoundingClientRect();
  return x >= (r.left - m) &&
    x <= (r.right + m) &&
    y >= (r.top - m) &&
    y <= (r.bottom + m);
}

// câmera
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  return new Promise(r => video.onloadedmetadata = () => r(video));
}

// carrega perguntas de CSV
async function carregarCSV() {
  const res = await fetch('perguntas.csv');
  const txt = await res.text();
  const linhas = txt.trim().split('\n');
  return linhas.slice(1).map(linha => {
    const v = linha.split(';');
    return {
      pergunta: v[0],
      opcoes: v.slice(1, 5),
      correta: parseInt(v[5], 10) - 1,
      disciplina: v[6] || 'Geral',
      dificuldade: parseInt(v[7], 10)
    };
  });
}

function iniciarCronometro() {
  tempoRestante = 15;
  atualizarCronometro();
  if (intervaloTempo) clearInterval(intervaloTempo);

  intervaloTempo = setInterval(() => {
    tempoRestante--;
    atualizarCronometro();

    if (tempoRestante <= 0) {
      clearInterval(intervaloTempo);
      const p = perguntasSelecionadas[perguntaAtual];
      feedbackMessage.textContent = `⏰ Tempo esgotado! Resposta: ${p.opcoes[p.correta]}`;
      feedbackContainer.classList.remove('hidden');
      contarErro(); // Considera erro se tempo acaba

      if (errosRodada < 3) {
        setTimeout(() => {  // Adicionei um delay para melhor experiência
          feedbackContainer.classList.add('hidden');
          mostrarPergunta(); // Próxima pergunta
        }, 1500);
      }
    } // <-- Faltava esta chave
  }, 1000);
} // <-- Esta fecha a função iniciarCronometro



function atualizarCronometro() {
  const cronometroElemento = document.getElementById('cronometro');
  if (cronometroElemento) {
    cronometroElemento.innerText = tempoRestante;

    // Remove todas as classes primeiro
    cronometroElemento.classList.remove('tempo-normal', 'tempo-aviso', 'tempo-perigo');

    // Aplica a classe conforme o tempo
    if (tempoRestante <= 5) {
      cronometroElemento.classList.add('tempo-perigo'); // Piscará automaticamente
    } else if (tempoRestante <= 10) {
      cronometroElemento.classList.add('tempo-aviso');
    } else {
      cronometroElemento.classList.add('tempo-normal');
    }
  }
}

function pararCronometro() {
  if (intervaloTempo) clearInterval(intervaloTempo);
}

// inicia o quiz
async function iniciarJogo() {
  jogoIniciado = true;
  exitTimer = restartTimer = nextTimer = null;
  tituloProjeto.classList.add('quiz-active');
  controlPanel.style.display = 'none';
  diffContainer.style.display = 'block';
  quizContainer.style.display = 'none';
  btnExit.style.display = 'none';
  score = 0;
  scoreEl.textContent = `Pontuação: ${score}`;
}

// escolhe dificuldade
function escolherDificuldade(nivel) {
  clearTimeout(selecionarDificTimer);
  carregarCSV().then(todas => {
    perguntasSelecionadas = [0, 1, 2].includes(nivel)
      ? todas.filter(p => p.dificuldade === nivel)
      : todas;

    // Embaralha perguntasSelecionadas usando Fisher-Yates
    for (let i = perguntasSelecionadas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perguntasSelecionadas[i], perguntasSelecionadas[j]] = [perguntasSelecionadas[j], perguntasSelecionadas[i]];
    }

    if (perguntasSelecionadas.length === 0) {
      alert("Nenhuma pergunta neste nível!");
      jogoIniciado = false;
      diffContainer.style.display = 'none';
      controlPanel.style.display = 'flex';
      tituloProjeto.classList.remove('quiz-active');
      return;
    }
    diffContainer.style.display = 'none';
    quizContainer.style.display = 'block';
    btnExit.style.display = 'block';
    perguntaAtual = 0;
    mostrarPergunta();
  });
}

// exibe pergunta e opções
function mostrarPergunta() {
  pararCronometro();
  const p = perguntasSelecionadas[perguntaAtual];
  perguntaBlock.textContent = p.pergunta;
  disciplinaBlock.textContent = p.disciplina;
  const labels = ['Fácil', 'Médio', 'Difícil', 'Aleatório'];
  dificuldadeBlock.textContent = `Nível: ${labels[p.dificuldade]}`;
  opcoesEl.innerHTML = '';
  p.opcoes.forEach((opc, i) => {
    const li = document.createElement('li');
    li.textContent = opc;
    li.dataset.index = i;
    opcoesEl.appendChild(li);
  });
  iniciarCronometro();
}

// seleciona uma opção e exibe feedback
function selecionarOpcao(idx) {
  clearTimeout(selecionarOpcTimer);
  pararCronometro();
  const p = perguntasSelecionadas[perguntaAtual];
  const isCorrect = idx === p.correta;
  if (isCorrect) {
    score++;
  } else {
    contarErro();
    // Só mostra feedback se não for o terceiro erro
    if (errosRodada < 3) {
      feedbackMessage.textContent = `❌ Errado! Resposta: ${p.opcoes[p.correta]}`;
      feedbackContainer.classList.remove('hidden');
    }
    return; // Sai da função se for erro
  }
  scoreEl.textContent = `Pontuação: ${score}`;
  feedbackMessage.textContent = isCorrect
    ? "✅ Correto!"
    : `❌ Errado! Resposta: ${p.opcoes[p.correta]}`;
  feedbackContainer.classList.remove('hidden');
}

// Próximo
btnNext.addEventListener('click', () => {
  feedbackContainer.classList.add('hidden');
  perguntaAtual++;
  if (perguntaAtual < perguntasSelecionadas.length) {
    mostrarPergunta();
  } else {
    mostrarResultados();
  }
});

// mostra tela de resultados
function mostrarResultados() {
  finalScore.textContent = `Pontuação: ${score}`;
  resultsScreen.classList.remove('hidden');
  quizContainer.style.display = 'none';
  diffContainer.style.display = 'none';
  btnExit.style.display = 'none';
  tituloProjeto.classList.remove('quiz-active');
}


function contarErro() {
  errosRodada++;
  atualizarErros();

  if (errosRodada >= 3) {
    exitGame();
  }
}

function atualizarErros() {
  const erroText = document.getElementById('erros-texto');
  if (erroText) {
    erroText.textContent = `${errosRodada}/3`;
  }
}

// sai do jogo
function exitGame() {
  if (!jogoIniciado) return;
  if (exitTimer) clearTimeout(exitTimer);
  exitTimer = null;
  pararCronometro();
  feedbackContainer.classList.add('hidden');
  mostrarResultados();
  jogoIniciado = false;
}

// reinicia o jogo
function restartGame() {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = null;
  resultsScreen.classList.add('hidden');
  controlPanel.style.display = 'flex';
  quizContainer.style.display = 'none';
  tituloProjeto.classList.remove('quiz-active');
  errosRodada = 0;
  atualizarErros();
}

btnExit.addEventListener('click', exitGame);
btnRestart.addEventListener('click', restartGame);

// loop principal de detecção
async function main() {
  await setupCamera();
  video.play();
  await tf.setBackend('webgl');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const model = handPoseDetection.SupportedModels.MediaPipeHands;
  const detector = await handPoseDetection.createDetector(model, {
    runtime: 'mediapipe',
    modelType: 'full',
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands'
  });

  async function detectar() {
    const hands = await detector.estimateHands(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    btnIniciar.classList.remove('hover');

    maoStatus.textContent = hands.length > 0 ? "Mão: OK" : "Mão: NÃO";

    if (hands.length > 0) {
      const hand = hands[0];
      hand.keypoints.forEach(k => {
        ctx.beginPath();
        ctx.arc(k.x, k.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
      });
      const ind = hand.keypoints[8];
      ctx.beginPath();
      ctx.arc(ind.x, ind.y, 20, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 4;
      ctx.stroke();

      const ex = window.innerWidth / canvas.width;
      const ey = window.innerHeight / canvas.height;
      const x = (canvas.width - ind.x) * ex;
      const y = ind.y * ey;

      // 0) se feedback aberto (agora também permite “Sair”)
      if (!feedbackContainer.classList.contains('hidden')) {
        const OVER_MARGIN = 40;
        const overNext = pontoSobreAlcance(x, y, btnNext, OVER_MARGIN);
        const overExit = pontoSobreAlcance(x, y, btnExit, OVER_MARGIN);

        if (overNext) {
          btnNext.classList.add('hover');
          btnExit.classList.remove('hover');
          clearTimeout(exitTimer);
          if (!nextTimer) nextTimer = setTimeout(() => {
            btnNext.click();
            nextTimer = null;
          }, timeDelay);
        }
        else if (overExit) {
          btnExit.classList.add('hover');
          btnNext.classList.remove('hover');
          clearTimeout(nextTimer);
          if (!exitTimer) exitTimer = setTimeout(() => {
            exitGame();
            exitTimer = null;
          }, timeDelay);
        }
        else {
          btnNext.classList.remove('hover');
          btnExit.classList.remove('hover');
          clearTimeout(nextTimer);
          clearTimeout(exitTimer);
          nextTimer = exitTimer = null;
        }
      }
      // 1) escolhe dificuldade
      else if (diffContainer.style.display === 'block') {
        const hovered = diffItems.find(li => pontoSobre(x, y, li));
        diffItems.forEach(li => li.classList.toggle('hover', li === hovered));
        if (hovered && currentDiffHover !== hovered) {
          clearTimeout(selecionarDificTimer);
          currentDiffHover = hovered;
          selecionarDificTimer = setTimeout(() => {
            escolherDificuldade(+hovered.dataset.nivel);
            currentDiffHover = null;
          }, timeDelay);
        }
        if (!hovered && currentDiffHover) {
          clearTimeout(selecionarDificTimer);
          currentDiffHover = null;
        }
      }
      // 2) quiz ativo
      else if (quizContainer.style.display === 'block') {
        const opcLis = Array.from(opcoesEl.querySelectorAll('li'));
        const hoveredOp = opcLis.find(li => pontoSobre(x, y, li));
        opcLis.forEach(li => li.classList.toggle('hover', li === hoveredOp));
        if (hoveredOp && currentOpcHover !== hoveredOp) {
          clearTimeout(selecionarOpcTimer);
          currentOpcHover = hoveredOp;
          selecionarOpcTimer = setTimeout(() => {
            selecionarOpcao(+hoveredOp.dataset.index);
            currentOpcHover = null;
          }, timeDelay);
        }
        if (!hoveredOp && currentOpcHover) {
          clearTimeout(selecionarOpcTimer);
          currentOpcHover = null;
        }
        // hover exit (na tela de quiz)
        const MARGIN_EXIT = 40;
        if (pontoSobreAlcance(x, y, btnExit, MARGIN_EXIT)) {
          btnExit.classList.add('hover');
          if (!exitTimer) exitTimer = setTimeout(exitGame, timeDelay);
        } else {
          btnExit.classList.remove('hover');
          clearTimeout(exitTimer);
          exitTimer = null;
        }
      }
      // 3) tela resultados
      else if (!resultsScreen.classList.contains('hidden')) {
        if (pontoSobre(x, y, btnRestart)) {
          btnRestart.classList.add('hover');
          if (!restartTimer) restartTimer = setTimeout(restartGame, timeDelay);
        } else {
          btnRestart.classList.remove('hover');
          clearTimeout(restartTimer);
          restartTimer = null;
        }
      }
      // 4) tela inicial
      else {
        if (pontoSobre(x, y, btnIniciar)) {
          btnIniciar.classList.add('hover');
          if (!jogoIniciado) setTimeout(iniciarJogo, timeDelay);
        }
      }
    }

    requestAnimationFrame(detectar);
  }

  detectar();
}

main();
