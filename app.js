// State variables
let currentQuestionIndex = 0;
let score = 0;
const pointsPerQuestion = 10;
let isAnswerProcessing = false;
let isGameOver = false;

// 1プレイあたりの出題数（全体からランダムに抽出）
const MAX_QUESTIONS_PER_PLAY = 10;
let quizData = []; // CSVから読み込んだ全問題データを格納する配列
let currentQuizSet = [];
let wrongAnswersHistory = []; // 誤答履歴の保存

// 配列をシャッフルするヘルパー関数
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// DOM Elements
const screens = {
  start: document.getElementById('start-screen'),
  quiz: document.getElementById('quiz-screen'),
  feedback: document.getElementById('feedback-screen'),
  result: document.getElementById('result-screen')
};

const dom = {
  startBtn: document.getElementById('start-btn'),
  genreSelect: document.getElementById('genre-select'),
  questionText: document.getElementById('question-text'),
  questionCategory: document.getElementById('question-category'),
  optionBtns: document.querySelectorAll('.option-btn'),
  counterBadge: document.getElementById('question-counter'),
  currentScore: document.getElementById('current-score'),
  progressBar: document.getElementById('progress-bar'),
  feedbackResult: document.getElementById('feedback-result'),
  explanationText: document.getElementById('explanation-text'),
  nextBtn: document.getElementById('next-btn'),
  finalScore: document.getElementById('final-score'),
  resultMessage: document.getElementById('result-message'),
  retryBtn: document.getElementById('retry-btn'),
  retireBtn: document.getElementById('retire-btn'),
  retireModal: document.getElementById('retire-modal'),
  cancelRetireBtn: document.getElementById('cancel-retire-btn'),
  confirmRetireBtn: document.getElementById('confirm-retire-btn'),
  correctAnswerDisplay: document.getElementById('correct-answer-display'),
  correctAnswerText: document.querySelector('#correct-answer-display span'),
  comboBadge: document.getElementById('combo-badge'),
  reviewBtn: document.getElementById('review-btn'),
  reviewModal: document.getElementById('review-modal'),
  closeReviewBtn: document.getElementById('close-review-btn'),
  reviewList: document.getElementById('review-list'),
  scoreCircle: document.querySelector('.score-circle-progress'),
  resultTitle: document.getElementById('result-title'),
  difficultyBadge: document.getElementById('difficulty-badge'),
  returnTitleBtn: document.getElementById('return-title-btn')
};

// Labels for options
const optionLabels = ['A', 'B', 'C', 'D'];

// Initialization
function init() {
  // Load data.csv before initializing the app
  Papa.parse('data.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      // 読み込んだCSVデータを quizData 配列フォーマットに変換
      quizData = results.data.map(row => ({
        category: row.Category,
        difficulty: parseInt(row.Difficulty, 10) || 1,
        question: row.Question,
        options: [row.Option1, row.Option2, row.Option3, row.Option4],
        answerIndex: parseInt(row.AnswerIndex, 10) || 0,
        explanation: row.Explanation
      }));
      
      setupApp();
    },
    error: function(err) {
      console.error("CSV読み込みエラー:", err);
      dom.questionText.textContent = "問題データの読み込みに失敗しました。";
    }
  });
}

function setupApp() {
  // CSVデータから一意のカテゴリを抽出してセレクトボックスを動的に構築
  setupDynamicGenres();

  // Update select options with dynamic counts
  const options = dom.genreSelect.querySelectorAll('option');
  options.forEach(opt => {
    if (opt.value !== 'all') {
      const count = quizData.filter(q => q.category === opt.value).length;
      opt.textContent += ` (全${count}問)`;
    } else {
      opt.textContent += ` (全${quizData.length}問)`;
    }
  });

  dom.startBtn.addEventListener('click', startQuiz);
  dom.nextBtn.addEventListener('click', handleNextBtn);
  dom.retryBtn.addEventListener('click', resetQuiz);
  dom.returnTitleBtn.addEventListener('click', () => {
    isGameOver = false;
    showScreen('start');
  });
  
  dom.retireBtn.addEventListener('click', showRetireModal);
  dom.cancelRetireBtn.addEventListener('click', hideRetireModal);
  dom.confirmRetireBtn.addEventListener('click', confirmRetire);
  
  dom.reviewBtn.addEventListener('click', () => dom.reviewModal.classList.add('active'));
  dom.closeReviewBtn.addEventListener('click', () => dom.reviewModal.classList.remove('active'));
  
  dom.optionBtns.forEach(btn => {
    btn.addEventListener('click', handleOptionSelect);
  });
}

// Extract unique categories and populate the select box
function setupDynamicGenres() {
  const categories = [...new Set(quizData.map(q => q.category))].filter(Boolean);
  
  // Clear existing options except 'all'
  dom.genreSelect.innerHTML = '<option value="all">🌐 オールジャンル完全制覇</option>';
  
  // スマホUI向けに絵文字を自動マッピング
  const emojiMap = {
    '情報セキュリティ': '🛡️',
    'Windows基礎': '💻',
    'ショートカットキー': '⌨️',
    'MS Office基礎': '📝',
    'ビジネス実務': '👔',
    'コンプライアンス': '⚖️',
    'ネットワーク基礎': '📡',
    'クラウド・最新IT': '☁️'
  };
  
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    const emoji = emojiMap[cat] || '📋';
    opt.textContent = `${emoji} ${cat}`;
    dom.genreSelect.appendChild(opt);
  });
}

// Navigation functions
function showScreen(screenName) {
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  screens[screenName].classList.add('active');
}

function startQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  isGameOver = false;
  wrongAnswersHistory = [];
  
  // 選択されたジャンルを取得してフィルタリング
  const selectedGenre = dom.genreSelect.value;
  let targetData = quizData;
  if (selectedGenre !== 'all') {
    targetData = quizData.filter(q => q.category === selectedGenre);
  }
  
  // 補充フラグを付けるため、全データを新しいオブジェクトのコピーとして扱う
  let shuffledData = shuffleArray(targetData).map(q => ({ ...q, isBonus: false }));
  
  // 指定の10問に満たない場合、他のジャンルから補充して「常に10問」に統一する
  if (shuffledData.length < MAX_QUESTIONS_PER_PLAY) {
    const remainingCount = MAX_QUESTIONS_PER_PLAY - shuffledData.length;
    const otherData = quizData.filter(q => q.category !== selectedGenre).map(q => ({ ...q, isBonus: true }));
    const shuffledOthers = shuffleArray(otherData);
    shuffledData = shuffledData.concat(shuffledOthers.slice(0, remainingCount));
  }
  
  currentQuizSet = shuffledData.slice(0, MAX_QUESTIONS_PER_PLAY);
  
  updateScoreDisplay();
  loadQuestion();
  showScreen('quiz');
}

function resetQuiz() {
  startQuiz();
}

function showRetireModal() {
  dom.retireModal.classList.add('active');
}

function hideRetireModal() {
  dom.retireModal.classList.remove('active');
}

function confirmRetire() {
  hideRetireModal();
  showScreen('start');
}

// Load Current Question
function loadQuestion() {
  isAnswerProcessing = false;
  const q = currentQuizSet[currentQuestionIndex];
  
  // Update Headers
  dom.counterBadge.textContent = `Q ${currentQuestionIndex + 1} / ${currentQuizSet.length}`;
  dom.progressBar.style.width = `${((currentQuestionIndex) / currentQuizSet.length) * 100}%`;
  
  // 選択肢のシャッフル（正解のインデックスを更新）
  const originalOptions = [...q.options];
  const correctAnswerText = originalOptions[q.answerIndex];
  const shuffledOptions = shuffleArray(originalOptions);
  q.currentAnswerIndex = shuffledOptions.indexOf(correctAnswerText);
  q.currentOptions = shuffledOptions;

  // Update Question Content
  let badgeText = q.category || '一般問題';
  if (q.isBonus) {
    badgeText += ' 🌟補充';
  }
  dom.questionCategory.textContent = badgeText;
  
  // 難易度の表示処理 (1: 基本, 2: 標準, 3: 難問)
  const diff = q.difficulty || 1; // 未指定の場合は「基本」
  if (dom.difficultyBadge) {
    if (diff === 3) {
      dom.difficultyBadge.innerHTML = '★★★ <span class="hard-text">難問！</span>';
      dom.difficultyBadge.className = 'difficulty-badge hard';
    } else if (diff === 2) {
      dom.difficultyBadge.innerHTML = '★★☆ 標準';
      dom.difficultyBadge.className = 'difficulty-badge normal';
    } else {
      dom.difficultyBadge.innerHTML = '★☆☆ 基本';
      dom.difficultyBadge.className = 'difficulty-badge easy';
    }
  }

  dom.questionText.textContent = q.question;
  
  // Update Options
  dom.optionBtns.forEach((btn, index) => {
    // Reset classes
    btn.className = 'btn option-btn';
    
    // Set content
    const labelSpan = btn.querySelector('.opt-label');
    const textSpan = btn.querySelector('.opt-text');
    labelSpan.textContent = optionLabels[index];
    textSpan.textContent = q.currentOptions[index];
    
    // Slight entry animation delay
    btn.style.opacity = '0';
    btn.style.transform = 'translateY(10px)';
    setTimeout(() => {
      btn.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      btn.style.opacity = '1';
      btn.style.transform = 'translateX(0)';
    }, 100 * index);
  });
}

// Handle Option Selection
function handleOptionSelect(e) {
  if (isAnswerProcessing) return;
  
  // 振動フィードバック (対応ブラウザのみ)
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }
  
  const selectedBtn = e.currentTarget;
  const selectedIndex = parseInt(selectedBtn.getAttribute('data-index'));
  const currentQ = currentQuizSet[currentQuestionIndex];
  
  isAnswerProcessing = true;
  
  // Step 1: Lock in answer (Millionaire style "Final Answer?" tension)
  selectedBtn.classList.add('selected');
  
  // Play subtle sound or just wait
  setTimeout(() => {
    checkAnswer(selectedBtn, selectedIndex, currentQ.currentAnswerIndex);
  }, 1200); // 1.2s delay for tension
}

// Final Check
function checkAnswer(selectedBtn, selectedIndex, correctIndex) {
  selectedBtn.classList.remove('selected');
  const currentQ = currentQuizSet[currentQuestionIndex];
  
  const isCorrect = selectedIndex === correctIndex;
  
  if (isCorrect) {
    // Correct
    selectedBtn.classList.add('correct');
    score += pointsPerQuestion;
    updateScoreDisplay();
    
    // コンボ演出（3問目以降）
    const currentCombo = currentQuestionIndex + 1;
    if (currentCombo === 3 || currentCombo === 5 || currentCombo === 7 || currentCombo === 9) {
      showComboBadge(`${currentCombo} COMBO!🔥`);
    }
    
    setupFeedback(true);
  } else {
    // Incorrect
    selectedBtn.classList.add('incorrect');
    selectedBtn.classList.add('shake');
    // Highlight correct answer
    dom.optionBtns[correctIndex].classList.add('correct');
    isGameOver = true;
    
    // 誤答履歴の保存
    wrongAnswersHistory.push({
      qText: currentQ.question,
      myAns: currentQ.currentOptions[selectedIndex],
      correctAns: currentQ.currentOptions[correctIndex],
      explanation: currentQ.explanation
    });
    
    setupFeedback(false);
  }
  
  // Move to feedback screen after showing result on buttons
  setTimeout(() => {
    showScreen('feedback');
  }, 1500);
}

function showComboBadge(text) {
  dom.comboBadge.textContent = text;
  dom.comboBadge.classList.remove('hidden');
  dom.comboBadge.classList.add('pop');
  setTimeout(() => {
    dom.comboBadge.classList.remove('pop');
    dom.comboBadge.classList.add('hidden');
  }, 1600);
}

function updateScoreDisplay() {
  dom.currentScore.textContent = score;
}

function setupFeedback(isCorrect) {
  const currentQ = currentQuizSet[currentQuestionIndex];
  
  if (isCorrect) {
    dom.feedbackResult.textContent = '正解！';
    dom.feedbackResult.className = 'feedback-badge correct';
    dom.correctAnswerDisplay.classList.add('hidden');
  } else {
    dom.feedbackResult.textContent = '不正解...';
    dom.feedbackResult.className = 'feedback-badge incorrect';
    // 正解の明示
    dom.correctAnswerDisplay.classList.remove('hidden');
    dom.correctAnswerText.textContent = currentQ.currentOptions[currentQ.currentAnswerIndex];
  }
  
  dom.explanationText.textContent = currentQ.explanation;
  
  // Update next button text if it's the last question
  if (currentQuestionIndex === currentQuizSet.length - 1 || isGameOver) {
    dom.nextBtn.textContent = '結果を見る';
  } else {
    dom.nextBtn.textContent = '次の問題へ';
  }
}

function handleNextBtn() {
  if (isGameOver) {
    showResultScreen();
    return;
  }
  
  currentQuestionIndex++;
  
  if (currentQuestionIndex < currentQuizSet.length) {
    loadQuestion();
    showScreen('quiz');
  } else {
    showResultScreen();
  }
}

function showResultScreen() {
  dom.progressBar.style.width = '100%';
  dom.finalScore.textContent = score;
  
  const maxScore = currentQuizSet.length * pointsPerQuestion;
  const percentage = score / maxScore;
  
  // オールジャンル・パーフェクト時の称号演出
  if (dom.genreSelect.value === 'all' && percentage === 1.0) {
    dom.resultTitle.textContent = '完全制覇';
    dom.resultTitle.classList.add('rainbow-text');
    dom.resultMessage.innerHTML = '<span class="rainbow-text">★オールジャンル完全制覇おめでとうございます！★<br>あなたは本物のセキュリティマスターです！</span>';
  } else {
    dom.resultTitle.textContent = 'クイズ結果';
    dom.resultTitle.classList.remove('rainbow-text');
    
    // Set custom messages based on score
    if (isGameOver) {
      const questionNum = currentQuestionIndex + 1;
      if (questionNum === 1) {
        dom.resultMessage.textContent = '1問目で即死...！知識不足が露呈しました。振り返りでセキュリティの基礎を学び直しましょう。';
      } else if (questionNum >= 8) {
        dom.resultMessage.textContent = `第${questionNum}問目で惜しくもゲームオーバー...！あと一息でした。誤答履歴をチェックしましょう！`;
      } else {
        dom.resultMessage.textContent = `第${questionNum}問目でゲームオーバー。振り返りを読んで確実に知識を身につけましょう。`;
      }
    } else if (percentage === 1.0) {
      dom.resultMessage.textContent = '素晴らしい！完璧なリテラシーです。そのままの意識を保ちましょう。';
    } else if (percentage >= 0.8) {
      dom.resultMessage.textContent = '優秀です！あと少しで完璧でした。振り返りで復習しましょう。';
    } else if (percentage >= 0.5) {
      dom.resultMessage.textContent = '基本的な知識はありますが、いくつかリスクがあります。振り返りが推奨されます。';
    } else {
      dom.resultMessage.textContent = '情報漏洩のリスクがあります。振り返りをよく読み、意識を高めましょう。';
    }
  }
  
  // 円グラフアニメーション (dasharray: 283)
  const circleCircumference = 283;
  const offset = circleCircumference - (percentage * circleCircumference);
  
  // 描画の安定のため、少し遅延を入れてからoffsetを適用する
  setTimeout(() => {
    dom.scoreCircle.style.strokeDashoffset = offset;
  }, 100);
  
  // 誤答がある場合は振り返りボタンを表示してリスト生成
  if (wrongAnswersHistory.length > 0) {
    dom.reviewBtn.style.display = 'block';
    dom.reviewList.innerHTML = '';
    wrongAnswersHistory.forEach((w) => {
      const item = document.createElement('div');
      item.className = 'review-item';
      item.innerHTML = `
        <div class="review-q">Q. ${w.qText}</div>
        <div class="review-ans-box">
          <div class="review-my-ans">あなたの回答: ${w.myAns}</div>
          <div class="review-correct-ans">正解: ${w.correctAns}</div>
        </div>
        <div class="review-exp">${w.explanation}</div>
      `;
      dom.reviewList.appendChild(item);
    });
  } else {
    dom.reviewBtn.style.display = 'none';
  }
  
  showScreen('result');
}

// Start app
window.addEventListener('DOMContentLoaded', init);
