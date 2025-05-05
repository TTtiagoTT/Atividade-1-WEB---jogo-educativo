// script.js
// seletor dos elementos 
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
const telaContagem = document.getElementById('tela-contagem');
const contadorTela = document.getElementById('contador-tela');

// variaveis globais
let jogoIniciado = false;
let perguntasSelecionadas = [];
let perguntaAtual = 0;
let score = 0;
let iniciarTimer = null;
let tempoRestante = 15;
let intervaloTempo;
let errosRodada = 0;

// timers do controle de hover-gesto
let currentDiffHover = null;
let selecionarDificTimer = null;
let currentOpcHover = null;
let selecionarOpcTimer = null;
let exitTimer = null;
let restartTimer = null;
let nextTimer = null;
let timeDelay = 1000;

// esconde aair até o quiz começar
btnExit.style.display = 'none';

// saber se a mão está na tela
function pontoSobre(x, y, el) {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

// saber se a mao esta na tela com margem
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

// carrega perguntas de CSV e embaralha para aleatoriedade das questoes 
async function carregarCSV() {
  const res = await fetch('perguntas.csv');
  const txt = await res.text();
  const linhas = txt.trim().split('\n');
  // remove o cabeçalho
  const perguntas = linhas.slice(1).map(linha => {
    const v = linha.split(';');
    return {
      pergunta: v[0],
      opcoes: v.slice(1, 5),
      correta: parseInt(v[5], 10) - 1,
      disciplina: v[6] || 'Geral',
      dificuldade: parseInt(v[7], 10)
    };
  });

  // Embaralha as perguntas ainda na carga inicial
  for (let i = perguntas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perguntas[i], perguntas[j]] = [perguntas[j], perguntas[i]];
  }

  return perguntas;
}

// inicia o cronometro
function iniciarCronometro() {
  tempoRestante = 15;
  atualizarCronometro();
  if (intervaloTempo) clearInterval(intervaloTempo);

  intervaloTempo = setInterval(() => {
    tempoRestante--;
    atualizarCronometro();

    if (tempoRestante <= 0) {
      clearInterval(intervaloTempo);

      // exibe feedback de tempo esgotado
      const p = perguntasSelecionadas[perguntaAtual];
      feedbackMessage.textContent = `⏰ Tempo esgotado! Resposta: ${p.opcoes[p.correta]}`;
      feedbackContainer.classList.remove('hidden');

      // conta erro, mas nao chama mostrarPergunta()
      contarErro();
      // aguarda que o usuário mova o dedo ate o botão "proximo"
      // e ai o hover/dataDelay disparara o nextTimer para btnNext.click()
    }
  }, 1000);
}


// atualiza o cronometro na tela
function atualizarCronometro() {
  const cronometroElemento = document.getElementById('cronometro');
  if (cronometroElemento) {
    cronometroElemento.innerText = tempoRestante;

    // remove todas as classes primeiro
    cronometroElemento.classList.remove('tempo-normal', 'tempo-aviso', 'tempo-perigo');

    // Aplica a classe conforme o tempo
    if (tempoRestante <= 5) {
      cronometroElemento.classList.add('tempo-perigo'); // faz piscar o tempo restante
    } else if (tempoRestante <= 10) {
      cronometroElemento.classList.add('tempo-aviso');
    } else {
      cronometroElemento.classList.add('tempo-normal');
    }
  }
}

// para o cronometro
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
    // ae nao houver perguntas para o nivel selecionado exibe alerta
    if (perguntasSelecionadas.length === 0) {
      alert("Nenhuma pergunta neste nível!");
      jogoIniciado = false;
      diffContainer.style.display = 'none';
      controlPanel.style.display = 'flex';
      tituloProjeto.classList.remove('quiz-active');
      return;
    }
    // esconde painel de dificuldade
    diffContainer.style.display = 'none';

    // limpa hover e timers para não repetir a escolha
    clearTimeout(selecionarDificTimer);
    currentDiffHover = null;
    diffItems.forEach(li => li.classList.remove('hover'));

    // mostra quiz e pergunta
    // Mostra a tela de contagem
    telaContagem.classList.remove('hidden');

    // inicia a contagem regressiva
    let count = 3;
    contadorTela.textContent = count;

    // atualiza o contador a cada segundo
    const intervalId = setInterval(() => {
      count--;
      if (count > 0) {
        contadorTela.textContent = count;
      } else {
        // esconde a tela de contagem e inicia o quiz
        clearInterval(intervalId);
        telaContagem.classList.add('hidden');
        quizContainer.style.display = 'block';
        btnExit.style.display = 'block';
        perguntaAtual = 0;
        mostrarPergunta();
      }
    }, 1000);
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
    const pesos = [1, 2, 3];
    const peso = pesos[p.dificuldade] || 1;
    score += peso;
  } else {
    contarErro();
    // so mostra feedback se nao for o terceiro erro
    if (errosRodada < 3) {
      feedbackMessage.textContent = `❌ Errado! Resposta: ${p.opcoes[p.correta]}`;
      feedbackContainer.classList.remove('hidden');
    }
    return; // sai da funcao se der erro
  }
  // se acertar ou errar, mostra feedback
  scoreEl.textContent = `Pontuação: ${score}`;
  feedbackMessage.textContent = isCorrect
    ? "✅ Correto!"
    : `❌ Errado! Resposta: ${p.opcoes[p.correta]}`;
  feedbackContainer.classList.remove('hidden');
}

// botao prox
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

// atualiza o numero de erros
function contarErro() {
  errosRodada++;
  atualizarErros();

  if (errosRodada >= 3) {
    exitGame();
  }
}

// atualiza o numero de erros na tela
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

// adiciona eventos aos botoes
btnExit.addEventListener('click', exitGame);
btnRestart.addEventListener('click', restartGame);

// loop principal de detecção
async function main() {
  await setupCamera();
  video.play();
  await tf.setBackend('webgl');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // carrega o modelo de detecção de maos
  const model = handPoseDetection.SupportedModels.MediaPipeHands;
  const detector = await handPoseDetection.createDetector(model, {
    runtime: 'mediapipe',
    modelType: 'full',
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands'
  });

  // ajusta o tamanho do canvas para o tamanho do video
  async function detectar() {
    const hands = await detector.estimateHands(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    btnIniciar.classList.remove('hover');

    maoStatus.textContent = hands.length > 0 ? "Mão: OK" : "Mão: NÃO";

    // desenha a mão
    if (hands.length > 0) {
      const hand = hands[0];
      hand.keypoints.forEach(k => {
        ctx.beginPath();
        ctx.arc(k.x, k.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
      });
      // desenha o dedo indicador
      const ind = hand.keypoints[8];
      ctx.beginPath();
      ctx.arc(ind.x, ind.y, 20, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // desenha o cursor
      const ex = window.innerWidth / canvas.width;
      const ey = window.innerHeight / canvas.height;
      const x = (canvas.width - ind.x) * ex;
      const y = ind.y * ey;

      // atualiza a posição do cursor
      if (!feedbackContainer.classList.contains('hidden')) {
        const OVER_MARGIN = 40;
        const overNext = pontoSobreAlcance(x, y, btnNext, OVER_MARGIN);
        const overExit = pontoSobreAlcance(x, y, btnExit, OVER_MARGIN);
        // hover exit (na tela de quiz)
        if (overNext) {
          btnNext.classList.add('hover');
          btnExit.classList.remove('hover');
          clearTimeout(exitTimer);
          // se o hover do btnNext estiver ativo, cancela o hover do btnExit
          if (!nextTimer) nextTimer = setTimeout(() => {
            btnNext.click();
            nextTimer = null;
          }, timeDelay);
        }
        // hover exit (na tela de quiz)
        else if (overExit) {
          btnExit.classList.add('hover');
          btnNext.classList.remove('hover');
          clearTimeout(nextTimer);
          // se o hover do btnExit estiver ativo, cancela o hover do btnNext e chama o exitGame
          if (!exitTimer) exitTimer = setTimeout(() => {
            exitGame();
            exitTimer = null;
          }, timeDelay);
        }
        // se nenhum dos dois botões estiver ativo, remove o hover
        else {
          btnNext.classList.remove('hover');
          btnExit.classList.remove('hover');
          clearTimeout(nextTimer);
          clearTimeout(exitTimer);
          nextTimer = exitTimer = null;
        }
      }
      // escolhe dificuldade
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
      // tela de quiz
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
      // tela resultados
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
      // tela inicial
      else {
        if (pontoSobre(x, y, btnIniciar)) {
          btnIniciar.classList.add('hover');
          if (!iniciarTimer && !jogoIniciado) {
            iniciarTimer = setTimeout(() => {
              iniciarJogo();
              iniciarTimer = null;
            }, timeDelay);
          }
        } else {
          btnIniciar.classList.remove('hover');
          clearTimeout(iniciarTimer);
          iniciarTimer = null;
        }
      }
    }
    // atualiza a posição do cursor
    requestAnimationFrame(detectar);
  }
  // inicia a detecção
  detectar();
}

main();
