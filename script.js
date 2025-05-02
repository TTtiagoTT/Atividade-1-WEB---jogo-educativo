// script.js
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const contador = document.getElementById('contador-dedos');
const btnIniciar = document.getElementById('btn-iniciar');
const btnConfig = document.getElementById('btn-config');

/* Helper: checa se ponto (x, y) está sobre botão */
function pontoSobreBotao(x, y, botao) {
  const rect = botao.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/* Conta dedos com lógica corrigida */
function contarDedos(keypoints, isLeftHand) {
  let levantados = 0;
  const dedos = [
    [8, 6],   // indicador
    [12, 10], // médio
    [16, 14], // anelar
    [20, 18]  // mindinho
  ];
  for (const [topo, base] of dedos) {
    if (keypoints[topo].y < keypoints[base].y) levantados++;
  }
  // Polegar: INVERTE a comparação do x
  const polegarAberto = isLeftHand
    ? keypoints[4].x < keypoints[3].x // mão esquerda do USUÁRIO: polegar à esquerda
    : keypoints[4].x > keypoints[3].x; // mão direita do USUÁRIO: polegar à direita
  if (polegarAberto) levantados++;
  return levantados;
}

/* Inicia a Câmera */
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    return new Promise(resolve => {
      video.onloadedmetadata = () => resolve(video);
    });
  } catch (error) {
    alert('Erro ao acessar a câmera: ' + error.message);
  }
}

//carregar perguntas do CSV
async function carregarCSV() {
    const resposta = await fetch('perguntas.csv');
    const texto = await resposta.text();
    const linhas = texto.trim().split('\n');
  
    const cabecalho = linhas[0].split(','); // ["pergunta", "opcao1", ..., "correta", "dificuldade"]
  
    const perguntas = linhas.slice(1).map(linha => {
      const valores = linha.split(',');
      return {
        pergunta: valores[0],
        opcoes: valores.slice(1, 5),
        correta: parseInt(valores[5]) - 1, // transforma de 1–4 para 0–3
        dificuldade: parseInt(valores[6])  // 0 = fácil, 1 = médio, 2 = difícil
      };
    });
  
    console.log("Perguntas carregadas:", perguntas);
    return perguntas;
  }

/* Lógica principal */
async function main() {    

     // Exemplo de uso:
  carregarCSV().then(perguntas => {
    // Aqui você pode filtrar por dificuldade se quiser
    const faceis = perguntas.filter(p => p.dificuldade === 0);
    console.log("Perguntas fáceis:", faceis);
  
    // ou usar todas:
    perguntas.forEach(p => {
      console.log(`[${p.dificuldade}] ${p.pergunta}`);
    });
  });

  await setupCamera();
  video.play();
  await tf.setBackend('webgl');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const model = handPoseDetection.SupportedModels.MediaPipeHands;
  const detectorConfig = {
    runtime: 'mediapipe',
    modelType: 'full',
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
  };
  const detector = await handPoseDetection.createDetector(model, detectorConfig);

  async function detectar() {
    const hands = await detector.estimateHands(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Remove destaque dos botões por padrão
    [btnIniciar, btnConfig].forEach(btn => btn.classList.remove('hover'));

    if (hands.length > 0) {
      let totalDedos = 0;
      for (const hand of hands) {
        for (const keypoint of hand.keypoints) {
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = 'red';
          ctx.fill();
        }
        // Correção da mão
       
        const isLeftHand = hand.handedness && hand.handedness.toLowerCase() === "left";
        const dedos = contarDedos(hand.keypoints, isLeftHand);
        totalDedos += dedos;

        // Detecção do gesto/indicado sobre botão
        const indicador = hand.keypoints[8];
        if (indicador) {
          // Ajusta para tela real
          const escalaLargura = window.innerWidth / canvas.width;
          const escalaAltura  = window.innerHeight / canvas.height;
          const x = (canvas.width - indicador.x) * escalaLargura;
          const y = indicador.y * escalaAltura;

          if (pontoSobreBotao(x, y, btnIniciar)) {
            btnIniciar.classList.add('hover');
            // Aqui você pode acionar função do botão se quiser
          }
          if (pontoSobreBotao(x, y, btnConfig)) {
            btnConfig.classList.add('hover');
            // Aqui também
          }
        }
      }
      contador.textContent = `Dedos levantados: ${totalDedos}`;
    } else {
      contador.textContent = `Nenhuma mão detectada`;
    }
    requestAnimationFrame(detectar);
  }
  detectar();
}
main();
